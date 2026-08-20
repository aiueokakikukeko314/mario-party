/**
 * CI 用: 環境変数 FIREBASE_CONFIG に入っている Firebase の設定スニペットを
 * .env.local に展開する。
 *
 * スマホだけで作業する人が GitHub Secrets に 7 個も手入力しなくて済むように、
 * Firebase コンソールに表示される次のようなスニペットを「まるごと貼り付け」で受け付ける。
 *
 *   const firebaseConfig = {
 *     apiKey: "AIza...",
 *     authDomain: "xxx.firebaseapp.com",
 *     databaseURL: "https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app",
 *     projectId: "xxx",
 *     storageBucket: "xxx.firebasestorage.app",
 *     messagingSenderId: "123456789",
 *     appId: "1:123:web:abc"
 *   };
 *
 * JSON 形式で貼られた場合も同じ正規表現で拾える。
 */
import { writeFileSync } from "node:fs";

const raw = process.env.FIREBASE_CONFIG;

if (!raw || raw.trim() === "") {
  console.error(
    [
      "FIREBASE_CONFIG が空です。",
      "",
      "GitHub の Settings → Secrets and variables → Actions → New repository secret で",
      "名前を FIREBASE_CONFIG にして、Firebase コンソールの設定スニペットを",
      "まるごと貼り付けてください（const firebaseConfig = { ... }; ごとで構いません）。",
    ].join("\n"),
  );
  process.exit(1);
}

// key: "value" の組をすべて拾う。JS のオブジェクトリテラルでも JSON でも同じ形。
const found = new Map();
for (const m of raw.matchAll(/["']?([A-Za-z_$][\w$]*)["']?\s*:\s*["']([^"']*)["']/g)) {
  found.set(m[1], m[2]);
}

/** Firebase の構成キー → Vite の環境変数名 */
const MAPPING = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  databaseURL: "VITE_FIREBASE_DATABASE_URL",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

/** これが欠けているとアプリが動かないキー（src/lib/firebase.ts の必須項目と一致させる） */
const REQUIRED = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];

const missing = REQUIRED.filter((key) => !found.get(key));
if (missing.length > 0) {
  console.error(`FIREBASE_CONFIG から次のキーを読み取れませんでした: ${missing.join(", ")}`);
  if (missing.includes("databaseURL")) {
    console.error(
      [
        "",
        "databaseURL が無い場合、Realtime Database をまだ作成していない可能性が高いです。",
        "先に Realtime Database を作成（ロケーション: asia-southeast1）してから、",
        "設定スニペットをコピーし直して Secret を更新してください。",
      ].join("\n"),
    );
  }
  process.exit(1);
}

const lines = [];
for (const [configKey, envName] of Object.entries(MAPPING)) {
  const value = found.get(configKey);
  if (value) lines.push(`${envName}=${value}`);
}

writeFileSync(".env.local", lines.join("\n") + "\n");

// 値そのものはログに出さない。読み取れたキー名だけ出す。
console.log(`.env.local を書き出しました（${lines.length} 項目）`);
console.log(`読み取れたキー: ${[...found.keys()].join(", ")}`);
