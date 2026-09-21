# SosoBook Agent 協作規範

完整產品規格請先閱讀 [MVP_SPEC.md](./MVP_SPEC.md)。

## 專案背景

SosoBook 是以「手帳 × 校園運動會 × 健身競賽」為主題的手機優先 PWA。

目前的品牌素材位於：

- `public/img/avatar/`
- `public/img/nav/`
- `public/img/sticker/`
- `public/img/badge/<series>/`
- `public/img/reference/spring-journal-reference.webp`

優先使用既有素材，不要在沒有需求時重新生成或替換人物、導覽 icon、貼紙與參考圖的視覺方向。

## 技術基線

- Vue 3、Vite、JavaScript
- Pinia、Vue Router
- Tailwind CSS 加客製手帳元件
- Firebase Authentication、Cloud Firestore
- `vite-plugin-pwa`
- GitHub Pages
- GitHub Actions 加 Firebase Admin SDK 建立競賽證書

除非使用者明確要求，不要新增 Render、自建 API server 或 Firebase Cloud Functions。

視覺底圖採淺色紙張與低對比藍灰格線。格線是背景材質，不是資料表格，不要套用到每一層卡片或使用高對比、霓虹、透視網格。

## 工作規則

1. 修改前先檢查檔案與既有變更，保留使用者未完成的工作。
2. 搜尋檔案與文字優先使用 `rg`。
3. 使用 `apply_patch` 編輯檔案，不使用 shell 重導向覆寫來源檔案。
4. 修改後依風險執行建置、測試或專項驗證。
5. 不要將 Firebase 金鑰、服務帳戶 JSON、GitHub token 或其他秘密值提交到 repository。
6. GitHub Actions 的 Firebase Admin 憑證只能使用 GitHub Secrets。
7. 用戶端不可寫入官方競賽證書或 `settled` 狀態。
8. 個人原始體重資料只能由本人讀取，競賽公開資料只存必要的百分比與排名。

## 產品規則

- 體重單位為 kg。
- 日期以 `Asia/Taipei` 與 `YYYY-MM-DD` 為準。
- 每日最多一筆紀錄。
- 補登只限最近 7 天，且要標記為補登。
- 競賽排名使用減重百分比。
- 結束日缺卡時採結束日前最近紀錄。
- 同分採並列名次。
- 證書建立後為不可變快照。
- 團體賽、推播、目標體重、公開 Profile 不在 MVP 範圍。

若需求需要改動上述規則，先更新 `MVP_SPEC.md`，再修改實作。

## 繁體中文與編碼

- 含繁體中文的 Markdown、Vue、JavaScript、JSON、YAML 檔案使用 UTF-8。
- 編輯後以 UTF-8 重新讀取檢查，不以 PowerShell 終端顯示作為唯一判斷。
- 檢查連續問號替代字元、U+FFFD 與常見 mojibake。
- 不要為了修正終端顯示而替換正確的繁體中文。

## 專案 Skills

專案專用 Skills 位於 `.agents/skills/`。涉及對應領域時，先閱讀該 Skill 的 `SKILL.md`：

- `sosobook-visual-style`：整體品牌、色彩、材質與畫面風格
- `sosobook-journal-ui`：日記本、貼紙、卡片、日曆與互動元件
- `sosobook-crayon-type`：蠟筆字、手寫字與文字層級
- `sosobook-pwa`：PWA、路由、離線與 GitHub Pages
- `sosobook-firebase`：Firebase Auth、Firestore、Rules 與資料隱私
- `sosobook-competition`：排名、暫算成績、結算快照與證書
