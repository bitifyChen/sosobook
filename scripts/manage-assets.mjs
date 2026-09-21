import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import readline from 'node:readline';
import sharp from 'sharp';

const projectRoot = process.cwd();
const imageRoot = path.join(projectRoot, 'public', 'img');
const registryPath = path.join(projectRoot, 'src', 'data', 'asset-registry.json');
const quality = Number(process.env.WEBP_QUALITY || 84);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const sourceExtensions = new Set(['.png', '.jpg', '.jpeg']);
const definitions = {
  avatar: { folder: 'avatar', collection: 'avatars' },
  sticker: { folder: 'sticker', collection: 'stickers' },
};
const managedKinds = Object.keys(definitions);

if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
  throw new Error('WEBP_QUALITY 必須是 1 到 100 之間的整數。');
}

const legacyMetadata = new Map([
  ['avatar/image-gen-1(3).webp', { key: 'avatar-1', alt: '人物角色一' }],
  ['avatar/image-gen-2(3).webp', { key: 'avatar-2', alt: '人物角色二' }],
  ['avatar/image-gen-3(2).webp', { key: 'avatar-3', alt: '人物角色三' }],
  ['avatar/image-gen-4(1).webp', { key: 'avatar-4', alt: '人物角色四' }],
  ['avatar/image-gen-5(1).webp', { key: 'avatar-5', alt: '人物角色五' }],
  ['avatar/image-gen-6(1).webp', { key: 'avatar-6', alt: '人物角色六' }],
  ['sticker/彩繪質感彩色啞鈴貼紙.webp', { key: 'dumbbell', alt: '啞鈴貼紙', label: '今天有力量' }],
  ['sticker/image-gen-2(5).webp', { key: 'sticker-2', alt: '心情貼紙二', label: '心情貼紙 2' }],
  ['sticker/image-gen-3(4).webp', { key: 'sticker-3', alt: '心情貼紙三', label: '心情貼紙 3' }],
  ['sticker/image-gen-4(3).webp', { key: 'sticker-4', alt: '心情貼紙四', label: '心情貼紙 4' }],
  ['sticker/image-gen-5(3).webp', { key: 'sticker-5', alt: '心情貼紙五', label: '心情貼紙 5' }],
  ['sticker/image-gen-6(3).webp', { key: 'sticker-6', alt: '心情貼紙六', label: '心情貼紙 6' }],
  ['sticker/image-gen-7(1).webp', { key: 'sticker-7', alt: '心情貼紙七', label: '心情貼紙 7' }],
  ['sticker/image-gen-8(1).webp', { key: 'sticker-8', alt: '心情貼紙八', label: '心情貼紙 8' }],
  ['sticker/image-gen-9(1).webp', { key: 'sticker-9', alt: '心情貼紙九', label: '心情貼紙 9' }],
  ['sticker/image-gen-10(1).webp', { key: 'sticker-10', alt: '心情貼紙十', label: '心情貼紙 10' }],
]);

const toPosix = (value) => value.split(path.sep).join('/');
const relativeToImageRoot = (filePath) => toPosix(path.relative(imageRoot, filePath));
const absoluteFromImagePath = (relativePath) => path.join(imageRoot, ...relativePath.split('/'));
const sourceStem = (relativePath) =>
  path.posix.basename(relativePath, path.posix.extname(relativePath));
const collectionFor = (kind) => definitions[kind].collection;

const readRegistry = async () => {
  try {
    const content = await fs.readFile(registryPath, 'utf8');
    const registry = JSON.parse(content);
    return {
      schemaVersion: 1,
      avatars: Array.isArray(registry.avatars) ? registry.avatars : [],
      stickers: Array.isArray(registry.stickers) ? registry.stickers : [],
      badges: Array.isArray(registry.badges) ? registry.badges : [],
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { schemaVersion: 1, avatars: [], stickers: [], badges: [] };
  }
};

const writeRegistry = async (registry) => {
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  const normalized = {
    schemaVersion: 1,
    avatars: [...registry.avatars].sort((left, right) => left.key.localeCompare(right.key)),
    stickers: [...registry.stickers].sort((left, right) => left.key.localeCompare(right.key)),
    badges: [...registry.badges],
  };
  await fs.writeFile(registryPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
};

const listFiles = async (kind, extensions = imageExtensions) => {
  const directory = path.join(imageRoot, definitions[kind].folder);
  const files = [];

  const visit = async (currentDirectory) => {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(filePath);
      }
    }
  };

  await visit(directory);
  return files.sort((left, right) => left.localeCompare(right));
};

const allEntries = (registry) => [
  ...registry.avatars.map((entry) => ({ kind: 'avatar', entry })),
  ...registry.stickers.map((entry) => ({ kind: 'sticker', entry })),
  ...registry.badges.map((entry) => ({ kind: 'badge', entry })),
];

const entryVersions = (entry) =>
  entry.versions?.length
    ? entry.versions
    : [
        {
          version: entry.currentVersion,
          file: entry.file,
          contentSha256: entry.contentSha256,
        },
      ];

const registeredFiles = (registry) =>
  new Set(
    allEntries(registry).flatMap(({ entry }) => [
      ...entryVersions(entry).map((item) => item.file),
      ...(entry.legacyFiles || []),
    ])
  );

const findByHash = (registry, kind, contentSha256) =>
  registry[collectionFor(kind)].find((entry) =>
    entryVersions(entry).some((version) => version.contentSha256 === contentSha256)
  );

const findByFile = (registry, relativePath) =>
  allEntries(registry).find(
    ({ entry }) =>
      entryVersions(entry).some((item) => item.file === relativePath) ||
      entry.legacyFiles?.includes(relativePath)
  );

const nextKey = (registry, kind) => {
  const entries = registry[collectionFor(kind)];
  const prefix = `${kind}-`;
  const numbers = entries
    .map((entry) => Number(entry.key.slice(prefix.length)))
    .filter((value) => Number.isInteger(value));
  let next = Math.max(0, ...numbers) + 1;
  let key = `${prefix}${next}`;
  while (entries.some((entry) => entry.key === key)) {
    next += 1;
    key = `${prefix}${next}`;
  }
  return key;
};

const defaultMetadata = (registry, kind, relativePath) => {
  const legacy =
    legacyMetadata.get(relativePath) ||
    legacyMetadata.get(`${relativePath.slice(0, -path.posix.extname(relativePath).length)}.webp`);
  if (legacy) return legacy;
  const index = registry[collectionFor(kind)].length + 1;
  return {
    key: nextKey(registry, kind),
    alt: kind === 'avatar' ? `人物角色 ${index}` : `心情貼紙 ${index}`,
    ...(kind === 'sticker' ? { label: `心情貼紙 ${index}` } : {}),
  };
};

const canonicalImageHash = async (filePath) => {
  const { data, info } = await sharp(filePath)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const header = Buffer.from(`${info.width}x${info.height}x${info.channels}\0`, 'utf8');
  return createHash('sha256')
    .update(Buffer.concat([header, data]))
    .digest('hex');
};

const convertToWebp = async (inputPath, outputPath) => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    await sharp(inputPath).rotate().webp({ quality, effort: 5 }).toFile(temporaryPath);
    await fs.rename(temporaryPath, outputPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
};

const removeSource = async (filePath) => {
  try {
    await fs.rm(filePath, { force: true });
    return true;
  } catch (error) {
    if (error.code === 'EBUSY' || error.code === 'EPERM') {
      console.warn(`保留檔案（目前被其他程式使用）：${relativeToImageRoot(filePath)}`);
      return false;
    }
    throw error;
  }
};

const createEntry = (registry, kind, contentSha256, metadata, version = 1) => {
  const assetId = randomUUID();
  const file = `${definitions[kind].folder}/${assetId}-v${String(version).padStart(3, '0')}.webp`;
  const timestamp = new Date().toISOString();
  return {
    key: metadata.key,
    assetId,
    status: 'active',
    currentVersion: version,
    contentSha256,
    file,
    ...(metadata.alt ? { alt: metadata.alt } : {}),
    ...(metadata.label ? { label: metadata.label } : {}),
    versions: [
      {
        version,
        file,
        contentSha256,
        createdAt: timestamp,
      },
    ],
  };
};

const bootstrapExistingWebp = async (registry, sourceBindings = new Map()) => {
  for (const kind of managedKinds) {
    const files = await listFiles(kind, new Set(['.webp']));
    for (const filePath of files) {
      const relativePath = relativeToImageRoot(filePath);
      if (findByFile(registry, relativePath)) continue;

      const pairedEntry = sourceBindings.get(`${kind}:${sourceStem(relativePath)}`);
      if (pairedEntry) {
        const removed = await removeSource(filePath);
        if (!removed) {
          pairedEntry.legacyFiles = [
            ...new Set([...(pairedEntry.legacyFiles || []), relativePath]),
          ];
        }
        continue;
      }

      const contentSha256 = await canonicalImageHash(filePath);
      const duplicate = findByHash(registry, kind, contentSha256);
      if (duplicate) {
        const removed = await removeSource(filePath);
        if (!removed) {
          duplicate.legacyFiles = [...new Set([...(duplicate.legacyFiles || []), relativePath])];
        }
        continue;
      }

      const metadata = defaultMetadata(registry, kind, relativePath);
      const entry = createEntry(registry, kind, contentSha256, metadata);
      await convertToWebp(filePath, absoluteFromImagePath(entry.file));
      const removed = await removeSource(filePath);
      if (!removed) entry.legacyFiles = [relativePath];
      registry[collectionFor(kind)].push(entry);
      console.log(`registered  ${relativePath} -> ${entry.file}`);
    }
  }
};

const processNewSources = async (registry) => {
  let converted = 0;
  let removed = 0;
  const sourceBindings = new Map();

  for (const kind of managedKinds) {
    const files = await listFiles(kind, sourceExtensions);
    for (const filePath of files) {
      const relativePath = relativeToImageRoot(filePath);
      const contentSha256 = await canonicalImageHash(filePath);
      const duplicate = findByHash(registry, kind, contentSha256);

      if (duplicate) {
        const wasRemoved = await removeSource(filePath);
        if (wasRemoved) removed += 1;
        if (!wasRemoved) {
          duplicate.legacyFiles = [...new Set([...(duplicate.legacyFiles || []), relativePath])];
        }
        sourceBindings.set(`${kind}:${sourceStem(relativePath)}`, duplicate);
        console.log(`duplicate    ${relativePath} -> ${duplicate.key}（移除來源檔）`);
        continue;
      }

      const metadata = defaultMetadata(registry, kind, relativePath);
      const entry = createEntry(registry, kind, contentSha256, metadata);
      await convertToWebp(filePath, absoluteFromImagePath(entry.file));
      await removeSource(filePath);
      registry[collectionFor(kind)].push(entry);
      sourceBindings.set(`${kind}:${sourceStem(relativePath)}`, entry);
      converted += 1;
      console.log(`converted    ${relativePath} -> ${entry.file}`);
    }
  }

  return { converted, removed, sourceBindings };
};

const findUpdateCandidates = async (registry, kind = null) => {
  const kinds = kind ? [kind].filter((item) => managedKinds.includes(item)) : managedKinds;
  const known = registeredFiles(registry);
  const candidates = [];
  for (const currentKind of kinds) {
    for (const filePath of await listFiles(currentKind)) {
      const relativePath = relativeToImageRoot(filePath);
      if (!known.has(relativePath)) candidates.push({ kind: currentKind, filePath, relativePath });
    }
  }
  return candidates;
};

const createPrompt = () =>
  readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt, rl) => new Promise((resolve) => rl.question(prompt, resolve));

const choose = async (title, options, rl) => {
  console.log(`\n${title}`);
  options.forEach((option, index) => console.log(`  ${index + 1}. ${option}`));
  const answer = (await ask('請輸入編號（q 離開）：', rl)).trim().toLowerCase();
  if (answer === 'q') return null;
  const index = Number(answer) - 1;
  return Number.isInteger(index) && options[index] ? index : choose(title, options, rl);
};

const confirm = async (message, rl) => {
  const answer = (await ask(`${message} [Y/n] `, rl)).trim().toLowerCase();
  return answer === '' || answer === 'y' || answer === 'yes';
};

const replaceEntry = async (registry, candidate, target) => {
  const contentSha256 = await canonicalImageHash(candidate.filePath);
  const targetVersions = entryVersions(target);
  const sameVersion = targetVersions.find((version) => version.contentSha256 === contentSha256);
  if (sameVersion) {
    await removeSource(candidate.filePath);
    return {
      changed: false,
      message: `內容已存在於 ${target.key} v${sameVersion.version}，已移除來源檔。`,
    };
  }

  const shared = findByHash(registry, candidate.kind, contentSha256);
  const nextVersion = target.currentVersion + 1;
  const nextFile = shared
    ? shared.file
    : `${definitions[candidate.kind].folder}/${target.assetId}-v${String(nextVersion).padStart(3, '0')}.webp`;
  if (!shared) await convertToWebp(candidate.filePath, absoluteFromImagePath(nextFile));

  targetVersions.forEach((version) => {
    if (version.version === target.currentVersion) version.status = 'retired';
  });
  targetVersions.push({
    version: nextVersion,
    file: nextFile,
    contentSha256,
    createdAt: new Date().toISOString(),
    ...(shared ? { sharedFrom: shared.key } : {}),
  });
  target.versions = targetVersions;
  target.currentVersion = nextVersion;
  target.contentSha256 = contentSha256;
  target.file = nextFile;
  await removeSource(candidate.filePath);
  return { changed: true, message: `${target.key} 已更新為 v${nextVersion}。` };
};

const runNew = async () => {
  const registry = await readRegistry();
  const result = await processNewSources(registry);
  await bootstrapExistingWebp(registry, result.sourceBindings);
  await writeRegistry(registry);
  console.log(
    `\nassets:new 完成：新增 ${result.converted} 張，移除重複來源 ${result.removed} 張。`
  );
  console.log(`Registry：${path.relative(projectRoot, registryPath)}`);
};

const runUpdate = async () => {
  const registry = await readRegistry();
  if (!allEntries(registry).length) {
    throw new Error('尚未建立 asset registry，請先執行 npm run assets。');
  }

  const rl = createPrompt();
  try {
    while (true) {
      const candidates = await findUpdateCandidates(registry);
      if (!candidates.length) {
        console.log('\n目前沒有等待處理的新圖片。');
        break;
      }

      const kinds = [...new Set(candidates.map((candidate) => candidate.kind))];
      const selectedKind =
        kinds.length === 1 ? kinds[0] : kinds[await choose('本次要調整哪個資料夾？', kinds, rl)];
      if (!selectedKind) break;

      const kindCandidates = candidates.filter((candidate) => candidate.kind === selectedKind);
      let selectedCandidate;
      if (kindCandidates.length === 1) {
        selectedCandidate = kindCandidates[0];
        const accepted = await confirm(`發現 ${selectedCandidate.relativePath}，要處理嗎？`, rl);
        if (!accepted) break;
      } else {
        const index = await choose(
          '本次要調整哪張圖片？',
          kindCandidates.map((candidate) => candidate.relativePath),
          rl
        );
        if (index === null) break;
        selectedCandidate = kindCandidates[index];
      }

      const entries = registry[collectionFor(selectedKind)].filter(
        (entry) => entry.status !== 'retired'
      );
      const targetIndex = await choose(
        '選擇要替換的既有資產：',
        entries.map((entry) => `${entry.key}（目前 v${entry.currentVersion}，${entry.file}）`),
        rl
      );
      if (targetIndex === null) break;
      const target = entries[targetIndex];
      const accepted = await confirm(
        `確認用 ${selectedCandidate.relativePath} 替換 ${target.key}？`,
        rl
      );
      if (!accepted) continue;

      const result = await replaceEntry(registry, selectedCandidate, target);
      await writeRegistry(registry);
      console.log(`\n完成：${result.message}`);

      const continueUpdate = await confirm('要繼續處理其他新圖片嗎？', rl);
      if (!continueUpdate) break;
    }
  } finally {
    rl.close();
  }
};

const mode = process.argv[2] || 'new';
if (mode === 'new') await runNew();
else if (mode === 'update') await runUpdate();
else throw new Error(`不支援的 assets 模式：${mode}。可使用 new 或 update。`);
