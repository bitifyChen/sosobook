import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const MAX_STICKERS_PER_RECORD = 5;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const legacyStickerIdsFor = (record = {}) => {
  const stickerId = record.stickerId;
  return typeof stickerId === 'string' && stickerId.trim()
    ? [stickerId.trim()].slice(0, MAX_STICKERS_PER_RECORD)
    : [];
};

export const needsStickerIdsMigration = (record = {}) => !hasOwn(record, 'stickerIds');

const readServiceAccount = () => {
  const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (credentialJson) {
    try {
      return JSON.parse(credentialJson);
    } catch (cause) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON 不是有效 JSON：${cause.message}`);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  }

  return null;
};

const initializeAdminFirestore = () => {
  if (!getApps().length) {
    const serviceAccount = readServiceAccount();
    if (serviceAccount) {
      initializeApp({ credential: cert(serviceAccount) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() });
    } else {
      throw new Error(
        '找不到 Firebase Admin 憑證。請設定 FIREBASE_SERVICE_ACCOUNT_JSON、' +
          'FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY，或 GOOGLE_APPLICATION_CREDENTIALS。'
      );
    }
  }
  return getFirestore();
};

const createStats = () => ({
  usersScanned: 0,
  recordsScanned: 0,
  plannedUpdates: 0,
  skippedRecords: 0,
  updatedRecords: 0,
  errorRecords: 0,
});

export const migrateStickerIds = async ({ db, apply = false, log = console.log } = {}) => {
  if (!db) throw new Error('migrateStickerIds 需要 Firebase Admin Firestore instance。');

  const stats = createStats();
  const errors = [];
  const usersSnapshot = await db.collection('users').get();
  stats.usersScanned = usersSnapshot.size;

  for (const userSnapshot of usersSnapshot.docs) {
    let recordsSnapshot;
    try {
      recordsSnapshot = await userSnapshot.ref.collection('weightRecords').get();
    } catch (cause) {
      stats.errorRecords += 1;
      errors.push({
        path: `${userSnapshot.ref.path}/weightRecords`,
        message: cause.message || String(cause),
      });
      log(
        `[sticker-migration] 異常 ${userSnapshot.ref.path}/weightRecords: ${cause.message || cause}`
      );
      continue;
    }

    for (const recordSnapshot of recordsSnapshot.docs) {
      stats.recordsScanned += 1;
      try {
        const record = recordSnapshot.data();
        if (!needsStickerIdsMigration(record)) {
          stats.skippedRecords += 1;
          continue;
        }

        const stickerIds = legacyStickerIdsFor(record);
        stats.plannedUpdates += 1;
        const path = recordSnapshot.ref.path;
        log(
          `[sticker-migration] ${apply ? '更新' : '預計更新'} ${path} -> ${JSON.stringify(stickerIds)}`
        );

        if (!apply) continue;

        await recordSnapshot.ref.update({ stickerIds });
        stats.updatedRecords += 1;
      } catch (cause) {
        stats.errorRecords += 1;
        const path = recordSnapshot.ref.path;
        errors.push({ path, message: cause.message || String(cause) });
        log(`[sticker-migration] 異常 ${path}: ${cause.message || cause}`);
      }
    }
  }

  return { stats, errors };
};

const printSummary = ({ apply, stats, errors }) => {
  const mode = apply ? 'apply' : 'dry-run';
  console.log('');
  console.log(`[sticker-migration] 完成（${mode}）`);
  console.log(`- 使用者掃描：${stats.usersScanned}`);
  console.log(`- 紀錄掃描：${stats.recordsScanned}`);
  console.log(`- 預計更新：${stats.plannedUpdates}`);
  console.log(`- 跳過（已有 stickerIds）：${stats.skippedRecords}`);
  console.log(`- 實際更新：${stats.updatedRecords}`);
  console.log(`- 異常：${stats.errorRecords}`);
  if (errors.length) {
    console.log(`- 異常明細：${JSON.stringify(errors)}`);
  }
};

const run = async () => {
  const args = new Set(process.argv.slice(2));
  const supportedArgs = new Set(['--apply', '--dry-run']);
  const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg));
  if (unknownArgs.length) {
    throw new Error(
      `不支援的參數：${unknownArgs.join(', ')}。預設為 dry-run；執行寫入請使用 --apply。`
    );
  }
  if (args.has('--apply') && args.has('--dry-run')) {
    throw new Error('不可同時使用 --apply 與 --dry-run。');
  }

  const apply = args.has('--apply');
  const result = await migrateStickerIds({ db: initializeAdminFirestore(), apply });
  printSummary({ apply, ...result });
  if (result.stats.errorRecords) process.exitCode = 1;
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  run().catch((cause) => {
    console.error(`[sticker-migration] 失敗：${cause.message || cause}`);
    process.exitCode = 1;
  });
}
