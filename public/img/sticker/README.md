# 貼紙資產規則

頭像與貼紙的正式 WebP 檔案都放在各自資料夾的根目錄：

```text
public/img/avatar/*.webp
public/img/sticker/*.webp
```

貼紙分類不使用資料夾。分類記錄在 `src/data/asset-registry.json` 的 `category` 欄位，例如：

```json
{
  "key": "sticker-24",
  "assetId": "...",
  "category": "outdoors"
}
```

新增 PNG、JPG 或 JPEG 後執行 `npm run assets`，程式會轉成 UUID WebP、移除來源檔，並寫入 registry。完成後可用 `npm run assets:check` 確認檔名 ID、JSON 路徑與實體檔案一致。
