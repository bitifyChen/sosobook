import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version || '0.0.0';
export const APP_CREDIT = 'chenchen';
export const APP_VERSION_LABEL = `v${APP_VERSION} @ ${APP_CREDIT}`;
// 提升這個版本時，低於此版本的舊版會要求使用者先更新才能繼續使用。
export const MINIMUM_SUPPORTED_VERSION = '0.1.0';
