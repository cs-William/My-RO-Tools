import { DurableObject } from "cloudflare:workers";

const SITE_ORIGIN = "https://cs-william.github.io";
const VIEW_DEDUPE_MS = 30 * 60 * 1000;
const ONLINE_TTL_MS = 90 * 1000;

function json(data, status = 200, origin = null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  if (origin === SITE_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", SITE_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(data), { status, headers });
}

async function hashVisitorId(visitorId) {
  const bytes = new TextEncoder().encode(visitorId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class StatsDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);

    const sql = ctx.storage.sql;
    sql.exec(
      "CREATE TABLE IF NOT EXISTS counters (id INTEGER PRIMARY KEY, total_views INTEGER NOT NULL)"
    );
    sql.exec(
      "INSERT OR IGNORE INTO counters (id, total_views) VALUES (1, 0)"
    );
    sql.exec(
      "CREATE TABLE IF NOT EXISTS visitor_views (visitor_id TEXT PRIMARY KEY, last_counted_at INTEGER NOT NULL)"
    );
    sql.exec(
      "CREATE INDEX IF NOT EXISTS visitor_views_time_idx ON visitor_views(last_counted_at)"
    );
    sql.exec(
      "CREATE TABLE IF NOT EXISTS presence (visitor_id TEXT PRIMARY KEY, last_seen_at INTEGER NOT NULL)"
    );
  }

  getStats() {
    const now = Date.now();
    const sql = this.ctx.storage.sql;

    sql.exec("DELETE FROM presence WHERE last_seen_at <= ?", now - ONLINE_TTL_MS);

    const totalViews = sql
      .exec("SELECT total_views FROM counters WHERE id = 1")
      .one().total_views;

    const onlineNow = sql
      .exec("SELECT COUNT(*) AS count FROM presence")
      .one().count;

    return { totalViews, onlineNow };
  }

  recordView(visitorId) {
    const now = Date.now();
    const sql = this.ctx.storage.sql;

    sql.exec(
      "DELETE FROM visitor_views WHERE last_counted_at <= ?",
      now - 24 * 60 * 60 * 1000
    );

    const previous = sql
      .exec(
        "SELECT last_counted_at FROM visitor_views WHERE visitor_id = ?",
        visitorId
      )
      .toArray()[0];

    if (!previous || now - previous.last_counted_at >= VIEW_DEDUPE_MS) {
      sql.exec(
        `INSERT INTO visitor_views (visitor_id, last_counted_at)
         VALUES (?, ?)
         ON CONFLICT(visitor_id) DO UPDATE SET last_counted_at = excluded.last_counted_at`,
        visitorId,
        now
      );
      sql.exec("UPDATE counters SET total_views = total_views + 1 WHERE id = 1");
    }

    return this.getStats();
  }

  heartbeat(visitorId) {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO presence (visitor_id, last_seen_at)
       VALUES (?, ?)
       ON CONFLICT(visitor_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
      visitorId,
      now
    );

    return this.getStats();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (origin && origin !== SITE_ORIGIN) {
      return json({ error: "origin_not_allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      if (origin !== SITE_ORIGIN) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": SITE_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("my-ro-tools-stats ready", {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    if (request.method === "GET" && url.pathname === "/api/stats") {
      const stats = env.STATS.getByName("my-ro-tools");
      return json(await stats.getStats(), 200, origin);
    }

    if (
      request.method !== "POST" ||
      !["/api/view", "/api/heartbeat"].includes(url.pathname)
    ) {
      return json({ error: "not_found" }, 404, origin);
    }

    if (origin !== SITE_ORIGIN) {
      return json({ error: "origin_required" }, 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400, origin);
    }

    if (
      typeof body.visitorId !== "string" ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(body.visitorId)
    ) {
      return json({ error: "invalid_visitor_id" }, 400, origin);
    }

    const visitorId = await hashVisitorId(body.visitorId);
    const stats = env.STATS.getByName("my-ro-tools");
    const result =
      url.pathname === "/api/view"
        ? stats.recordView(visitorId)
        : stats.heartbeat(visitorId);

    return json(await result, 200, origin);
  }
};
