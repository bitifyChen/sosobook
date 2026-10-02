import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version || '0.0.0';
export const APP_CREDIT = 'chenchen';
export const APP_VERSION_LABEL = `v${APP_VERSION} @ ${APP_CREDIT}`;
// 0.2.0 開始允許多貼紙；Rules 也會要求用戶端寫入 stickerIds。
// 發布相容雙寫版後，版本檔會要求低於此版本的舊版先更新。
export const MINIMUM_SUPPORTED_VERSION = '0.2.0';
