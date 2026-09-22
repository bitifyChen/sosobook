import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version || '0.0.0';
export const APP_CREDIT = 'chenchen';
export const APP_VERSION_LABEL = `v${APP_VERSION} @ ${APP_CREDIT}`;
