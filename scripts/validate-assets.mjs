import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const imageRoot = path.join(projectRoot, 'public', 'img');
const registryPath = path.join(projectRoot, 'src', 'data', 'asset-registry.json');
const definitions = {
  avatars: { folder: 'avatar', label: '頭像' },
  stickers: { folder: 'sticker', label: '貼紙' },
};

const toPosix = (value) => value.split(path.sep).join('/');
const imagePath = (relativePath) => path.join(imageRoot, ...relativePath.split('/'));
const errors = [];
const warnings = [];
const actualFiles = new Set();
const registeredFiles = new Set();
const ids = new Map();
const hashes = new Map();

const exists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const collectWebp = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectWebp(filePath);
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.webp') {
      actualFiles.add(toPosix(path.relative(imageRoot, filePath)));
    }
  }
};

const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));

for (const [collection, definition] of Object.entries(definitions)) {
  if (!Array.isArray(registry[collection])) {
    errors.push(`${collection} 不是陣列`);
    continue;
  }

  await collectWebp(path.join(imageRoot, definition.folder));

  for (const entry of registry[collection]) {
    if (ids.has(entry.assetId)) errors.push(`assetId 重複：${entry.assetId}`);
    ids.set(entry.assetId, `${collection}.${entry.key}`);

    if (!Array.isArray(entry.versions) || !entry.versions.length) {
      errors.push(`${collection}.${entry.key} 缺少 versions`);
      continue;
    }

    const current = entry.versions.find((version) => version.version === entry.currentVersion);
    if (!current) {
      errors.push(`${collection}.${entry.key} 找不到 currentVersion=${entry.currentVersion}`);
      continue;
    }
    if (entry.file !== current.file || entry.contentSha256 !== current.contentSha256) {
      errors.push(`${collection}.${entry.key} 的 current 欄位與 versions 不一致`);
    }

    for (const version of entry.versions) {
      registeredFiles.add(version.file);
      const expectedPrefix = `${definition.folder}/${entry.assetId}-v`;
      if (!version.file.startsWith(expectedPrefix) || !version.file.endsWith('.webp')) {
        errors.push(`${collection}.${entry.key} 的檔名 ID 與 assetId 不一致：${version.file}`);
      }
      if (!(await exists(imagePath(version.file)))) {
        errors.push(`${collection}.${entry.key} 缺少實體檔：${version.file}`);
      }
      if (!/^[a-f0-9]{64}$/i.test(version.contentSha256 || '')) {
        errors.push(`${collection}.${entry.key} 的 contentSha256 格式錯誤`);
      }
      if (hashes.has(version.contentSha256)) {
        errors.push(
          `contentSha256 重複：${version.contentSha256}（${hashes.get(version.contentSha256)} 與 ${collection}.${entry.key}）`
        );
      }
      hashes.set(version.contentSha256, `${collection}.${entry.key}`);
    }

    for (const legacyFile of entry.legacyFiles || []) {
      registeredFiles.add(legacyFile);
      if (!(await exists(imagePath(legacyFile)))) {
        warnings.push(`${collection}.${entry.key} 的 legacy 檔不存在：${legacyFile}`);
      }
    }
  }
}

for (const file of actualFiles) {
  if (!registeredFiles.has(file)) errors.push(`實體 WebP 沒有 registry 紀錄：${file}`);
}

console.log(`資產檢查：${actualFiles.size} 個實體 WebP、${registeredFiles.size} 個 registry 路徑`);
for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log('OK：assetId、檔名、current path、版本紀錄與實體檔一致。');
}
