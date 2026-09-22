import packageJson from '../../package.json';

const [major = '0', minor = '0'] = packageJson.version.split('.');

export const APP_VERSION = `${major}.${minor}`;
export const APP_CREDIT = 'chenchen';
export const APP_VERSION_LABEL = `v${APP_VERSION} @ ${APP_CREDIT}`;
