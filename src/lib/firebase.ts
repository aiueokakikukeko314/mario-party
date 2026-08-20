import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

/**
 * Firebase の初期化と匿名サインイン。
 * 構成値は .env.local から読む（CLAUDE.md セクション15: コードに直書きしない）。
 */

const REQUIRED_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

function readEnv(): Record<string, string> {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const missing = REQUIRED_KEYS.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `.env.local に次の値が設定されていません: ${missing.join(", ")}\n` +
        `.env.local.example をコピーして Firebase の構成値を記入してください。`,
    );
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function buildOptions(env: Record<string, string>): FirebaseOptions {
  // 必須キーは readEnv() で検証済みなので、ここでは空文字にフォールバックしない。
  const options: FirebaseOptions = {
    apiKey: env["VITE_FIREBASE_API_KEY"] as string,
    authDomain: env["VITE_FIREBASE_AUTH_DOMAIN"] as string,
    databaseURL: env["VITE_FIREBASE_DATABASE_URL"] as string,
    projectId: env["VITE_FIREBASE_PROJECT_ID"] as string,
    appId: env["VITE_FIREBASE_APP_ID"] as string,
  };
  // 任意項目は値がある場合だけ付ける（exactOptionalPropertyTypes 対応）。
  const bucket = env["VITE_FIREBASE_STORAGE_BUCKET"];
  if (bucket) options.storageBucket = bucket;
  const senderId = env["VITE_FIREBASE_MESSAGING_SENDER_ID"];
  if (senderId) options.messagingSenderId = senderId;
  return options;
}

const app = initializeApp(buildOptions(readEnv()));

export const auth: Auth = getAuth(app);
export const db: Database = getDatabase(app);

/**
 * 匿名サインイン完了を待つ Promise。uid を解決する。
 * 一度サインインすれば、同じブラウザでは同じ uid が再利用される
 * （リロードしても同じ席に戻れる ＝ CLAUDE.md セクション12 の前提）。
 */
export const authReady: Promise<string> = new Promise<string>(
  (resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user: User | null) => {
        if (user) {
          unsubscribe();
          resolve(user.uid);
        }
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
    // 既にサインイン済みなら onAuthStateChanged が先に発火して解決する。
    signInAnonymously(auth).catch((error: unknown) => {
      unsubscribe();
      reject(error);
    });
  },
);

/** 現在の uid。サインイン前は null。 */
export function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}
