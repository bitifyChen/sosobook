import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const sourceExtensions = new Set(['.png', '.jpg', '.jpeg']);
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.ts',
  '.tsx',
  '.vue',
  '.yaml',
  '.yml',
]);
const ignoredDirectories = new Set(['.git', '.firebase', '.preview', 'dist', 'node_modules']);
const scriptPath = path.resolve(projectRoot, 'scripts', 'convert-images-to-webp.mjs');
const quality = Number(process.env.WEBP_QUALITY || 84);

if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
  throw new Error('WEBP_QUALITY 必須是 1 到 100 之間的整數。');
}

const toPosix = (value) => value.split(path.sep).join('/');
const relativePath = (filePath) => toPosix(path.relative(projectRoot, filePath));

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(entryPath)));
    else files.push(entryPath);
  }

  return files;
}

function imageVariants(filePath) {
  const relative = relativePath(filePath);
  const publicRelative = relative.startsWith('public/') ? relative.slice('public/'.length) : null;
  const variants = new Set([relative, `./${relative}`, `/${relative}`]);

  if (publicRelative) {
    variants.add(publicRelative);
    variants.add(`./${publicRelative}`);
    variants.add(`/${publicRelative}`);

    if (publicRelative.startsWith('img/')) {
      const imageRelative = publicRelative.slice('img/'.length);
      variants.add(imageRelative);
      variants.add(`./${imageRelative}`);
      variants.add(`/${imageRelative}`);
    }
  }

  return [...variants].sort((a, b) => b.length - a.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildReferenceReplacements(imageFiles) {
  const replacements = new Map();

  for (const filePath of imageFiles) {
    const extension = path.extname(filePath);
    const webpPath = `${filePath.slice(0, -extension.length)}.webp`;
    for (const variant of imageVariants(filePath)) {
      const replacement = `${variant.slice(0, -extension.length)}.webp`;
      replacements.set(variant, replacement);
    }
    replacements.set(relativePath(filePath), relativePath(webpPath));
  }

  return [...replacements.entries()].sort(([left], [right]) => right.length - left.length);
}

async function convertImages(imageFiles) {
  let converted = 0;
  let unchanged = 0;

  for (const filePath of imageFiles) {
    const extension = path.extname(filePath);
    const outputPath = `${filePath.slice(0, -extension.length)}.webp`;
    const inputStat = await fs.stat(filePath);
    const outputStat = await fs.stat(outputPath).catch(() => null);

    if (outputStat && outputStat.mtimeMs >= inputStat.mtimeMs) {
      unchanged += 1;
      continue;
    }

    await sharp(filePath).webp({ quality, effort: 5 }).toFile(outputPath);
    converted += 1;
    console.log(`converted  ${relativePath(filePath)} -> ${relativePath(outputPath)}`);
  }

  return { converted, unchanged };
}

async function replaceReferences(imageFiles) {
  const replacements = buildReferenceReplacements(imageFiles);
  const allFiles = await walk(projectRoot);
  const referenceFiles = allFiles.filter(
    (filePath) =>
      filePath !== scriptPath && textExtensions.has(path.extname(filePath).toLowerCase())
  );
  let changedFiles = 0;
  let replacedReferences = 0;

  for (const filePath of referenceFiles) {
    const original = await fs.readFile(filePath, 'utf8');
    let updated = original;
    let fileReplacements = 0;

    for (const [from, to] of replacements) {
      const expression = new RegExp(escapeRegExp(from), 'g');
      const matches = updated.match(expression);
      if (!matches) continue;
      fileReplacements += matches.length;
      updated = updated.replace(expression, to);
    }

    if (updated === original) continue;
    await fs.writeFile(filePath, updated, 'utf8');
    changedFiles += 1;
    replacedReferences += fileReplacements;
    console.log(`updated    ${relativePath(filePath)} (${fileReplacements} reference(s))`);
  }

  return { changedFiles, replacedReferences };
}

const allFiles = await walk(projectRoot);
const imageFiles = allFiles.filter(
  (filePath) =>
    filePath !== scriptPath && sourceExtensions.has(path.extname(filePath).toLowerCase())
);

if (!imageFiles.length) {
  console.log('No PNG, JPG, or JPEG files found.');
  process.exit(0);
}

const conversion = await convertImages(imageFiles);
const references = await replaceReferences(imageFiles);

console.log(`\nWebP conversion complete (quality ${quality}).`);
console.log(`Images: ${conversion.converted} converted, ${conversion.unchanged} already current.`);
console.log(
  `References: ${references.replacedReferences} replaced in ${references.changedFiles} file(s).`
);
