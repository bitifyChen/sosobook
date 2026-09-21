# SosoBook 徽章制度

## 系列與門檻

徽章先以三個系列開始：

- `record`：累積完成體重紀錄的次數
- `finish`：完成競賽的次數
- `champion`：取得冠軍的次數

使用者資料只保存可信的統計數字，例如 `weightRecordCount`、`completedCompetitionCount` 與 `championCount`；畫面再依門檻判斷已取得徽章與下一個目標。

## 資產流程

徽章圖片依系列放在 `public/img/badge/` 下的子資料夾，正式檔名使用達成次數，例如 `badge/record/120.webp`：

```text
public/img/badge/
├─ record/      # 1.webp、5.webp、30.webp
├─ finish/      # 1.webp、5.webp、10.webp
└─ champion/   # 1.webp、10.webp、20.webp
```

先將原始 PNG、JPG 或 JPEG 放進系列資料夾，再執行 `npm run badge`。指令會轉成同檔名的 WebP 並移除原始檔，不會寫入 asset registry。

- `npm run assets` 只管理頭像與貼紙，不會掃描或修改徽章
- 網站直接從數字 WebP 檔名推導徽章 key，例如 `record/30.webp` 對應 `record-30`
- 新增門檻時，只要將完成的 WebP 放進對應系列資料夾即可
- 若只是調整既有門檻，將新檔案轉成 WebP 後改成新的數字檔名即可

## 解鎖資料規則

未來 Firestore 建議使用：

```text
users/{uid}/badges/{badgeId}
```

使用者資料保存統計數字，而不是把目前徽章圖片清單寫死：

```text
users/{uid}.achievementStats
  weightRecordCount: 30
  completedCompetitionCount: 5
  championCount: 1
```

網站依目前已發布的數字 WebP 門檻計算狀態：

- 已達門檻：正常顯示徽章
- 下一個門檻：顯示模糊徽章與 `?`
- 尚未有下一個門檻：不顯示預測徽章

徽章圖片本身是網站靜態資產，不放在使用者文件中；使用者文件只保存統計數字、取得時間與必要的來源資訊。
