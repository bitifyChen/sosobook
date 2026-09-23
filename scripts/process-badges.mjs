import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const badgeRoot = path.join(projectRoot, 'public', 'img', 'badge');
const quality = Number(process.env.WEBP_QUALITY || 90);
const width = Number(process.env.WEBP_WIDTH || 512);
const sourceExtensions = new Set(['.png', '.jpg', '.jpeg']);

if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
  throw new Error('WEBP_QUALITY 必須是 1 到 100 之間的整數。');
}

if (!Number.isInteger(width) || width < 64 || width > 2048) {
  throw new Error('WEBP_WIDTH 必須是 64 到 2048 之間的整數。');
}

const toPosix = (value) => value.split(path.sep).join('/');
const relativeToProject = (filePath) => toPosix(path.relative(projectRoot, filePath));

const listSourceFiles = async () => {
  const files = [];

  const visit = async (directory) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
        continue;
      }
      if (entry.isFile() && sourceExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(filePath);
      }
    }
  };

  await visit(badgeRoot);
  return files.sort((left, right) => left.localeCompare(right));
};

const convertToWebp = async (inputPath, outputPath) => {
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    await sharp(inputPath)
      .rotate()
      .resize({
        width,
        height: width,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 5 })
      .toFile(temporaryPath);
    await fs.rm(outputPath, { force: true });
    await fs.rename(temporaryPath, outputPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
};

const sourceFiles = await listSourceFiles();
let converted = 0;

for (const inputPath of sourceFiles) {
  const outputPath = `${inputPath.slice(0, -path.extname(inputPath).length)}.webp`;
  await convertToWebp(inputPath, outputPath);
  await fs.rm(inputPath, { force: true });
  converted += 1;
  console.log(`badge       ${relativeToProject(inputPath)} -> ${relativeToProject(outputPath)}`);
}

console.log(`\nbadge 完成：轉換 ${converted} 張。`);
if (!converted) {
  console.log('目前沒有待轉換的 PNG、JPG 或 JPEG 徽章圖片。');
}
console.log('徽章不會寫入 asset registry；請將完成的 WebP 改名為數字門檻，例如 record/120.webp。');
