# RO 口袋戰記寵物圖鑑

《RO仙境傳說：口袋戰記》寵物圖鑑，提供寵物資料查詢、羈絆篩選與排序。圖鑑本身由 GitHub Pages 靜態發布；網站統計使用獨立的 Cloudflare Worker，不影響圖鑑的瀏覽與篩選功能。


## 功能

- 依寵物名稱搜尋，或勾選一種以上的類型。
- 以職業與戰鬥定位配對篩選，例如「盜賊 ↕ 刺客」；配對同時作為職業羈絆條件。
- 勾選距離及屬性羈絆，並設定最低符合類別數；配對職業、距離及屬性每類最多計 1 項。
- 顯示 T 級、卡別、寵物名、類型、體型、戰鬥定位、職業、魔物及符合的羈絆。
- 桌面版可點選每個表格欄名排序，再次點選可切換方向；手機版以資訊卡呈現，並提供排序選單與清除篩選按鈕。
- T 級、卡別／魔物及符合羈絆數預設依 T1→T4、UR→N、3→0 排序，皆可反向排序。
- 圖鑑筆數依頁面載入的資料自動計算，目前共 289 筆。
- 羈絆數與清除篩選控制放在圖鑑筆數旁；未選羈絆時羈絆數選單會停用。
- 頁首資訊列顯示 `index.html` 的最後更新時間，並列出匿名估算的瀏覽數與在線數。
- 頁首資訊區與伺服器／公會資訊並列顯示匿名估算的瀏覽數與在線瀏覽器數；手機版以單行精簡呈現。同一瀏覽器 30 分鐘內不重複計入瀏覽。

## 流量統計 Worker

Worker 程式位於 `worker/`，使用 SQLite Durable Object 儲存瀏覽數與在線狀態。網站每 30 秒送出一次在線心跳，超過 90 秒未更新的瀏覽器不再計入在線數。

部署前需安裝 Node.js，並在 `worker/` 目錄登入建立 Worker 的 Cloudflare 帳號後執行：

```powershell
npx wrangler login
npx wrangler deploy
```

Worker 名稱為 `my-ro-tools-stats`，網址為 `https://my-ro-tools-stats.cs037741192.workers.dev/`。部署 Worker 後，再將網站變更推送到 GitHub，讓 GitHub Pages 發布前端。

統計使用匿名隨機瀏覽器 ID 的雜湊；Worker 程式不讀取或儲存原始 IP。使用者清除網站資料、換瀏覽器或使用無痕視窗時，會被視為新的瀏覽器。此公開統計僅供參考，無法完全防止人為偽造；使用本機 `file://` 開啟網站時，統計 API 不會連線成功，請以 HTTPS 的 GitHub Pages 網址驗收。

Cloudflare 免費額度有用量限制；部署前請查看 Cloudflare 官方最新價格與帳戶用量。

## Google 搜尋

- 網頁提供描述、canonical 與社群分享 metadata；`sitemap.xml` 位於網站根目錄。
- 在 Google Search Console 新增網址前綴 `https://cs-william.github.io/My-RO-Tools/`，依 Google 提供的 HTML 驗證標籤加入 `index.html` 後發布，再提交 `https://cs-william.github.io/My-RO-Tools/sitemap.xml`。
- Search Console 驗證標籤需從網站擁有者的 Google 帳號取得；尚未加入任何驗證 token。索引與排名由 Google 決定，提交 sitemap 不保證排名或立即收錄。

## 本機使用

直接以瀏覽器開啟專案中的 `index.html` 即可使用。

## 發布到 GitHub Pages

將 `index.html` 與 `README.md` 放在 GitHub 儲存庫根目錄，推送變更後，確認儲存庫的 **Settings → Pages** 已設定發布來源，即可透過 Pages 網址瀏覽。

## 資料說明

本圖鑑為離線整理資料，非官方資料且不會即時同步，內容可能與遊戲目前版本不同；請以官方公告及遊戲內資訊為準。T 級欄位仍待依實際資料補齊；魔物欄位依卡別分類。

網頁使用 SQLite `pets` 資料同步產生的內嵌資料；更新資料庫後，需同步更新 `index.html`。

SQLite 的 `pets` 欄位使用英文：

`tier`, `card_type`, `name`, `family`, `size`, `battle_role`, `job`, `monster`, `bond_distance`, `bond_element`, `bond_job`

`monster` 依 `card_type` 對應：N=Normal、R=Rare、SR=Elite、SSR=MINI、UR=MVP。三個 `bond_*` 欄位在圖鑑中合併顯示於「符合的羈絆」。
