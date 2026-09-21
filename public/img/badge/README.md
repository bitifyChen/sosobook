# 徽章圖片放置規則

每一種徽章系列都有自己的資料夾：

```text
public/img/badge/
├─ record/       # 體重紀錄系列
├─ finish/       # 完賽系列
└─ champion/     # 冠軍系列
```

徽章的正式檔案使用「達成次數」命名，系列由資料夾決定：

- `record/1.webp`、`record/5.webp`、`record/30.webp`
- `finish/1.webp`、`finish/5.webp`、`finish/10.webp`
- `champion/1.webp`、`champion/10.webp`、`champion/20.webp`

新增徽章時，可以先把原始 PNG、JPG 或 JPEG 放到對應系列資料夾，再執行：

```bash
npm run badge
```

這個指令只會處理 `public/img/badge/` 內的 PNG、JPG、JPEG，輸出同檔名的 WebP 並移除原始檔；不會寫入 `src/data/asset-registry.json`。

轉換完成後，請將檔名改成新的達成次數，例如 `record/120.webp`。網站會直接掃描三個系列資料夾中的數字 WebP，並將它顯示為下一個可解鎖徽章。

`npm run assets` 不會處理徽章，只管理頭像與貼紙的 UUID／版本資產。
