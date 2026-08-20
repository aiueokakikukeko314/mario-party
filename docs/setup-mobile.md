# スマホだけでセットアップする手順

PC・ターミナルを使わず、スマホのブラウザだけで Phase 0 の動作確認まで到達するための手順。

やることは大きく 3 つ。

1. GitHub Pages で公開できるようにする（リポジトリを公開＋Pages を有効化）
2. Firebase を作って、設定を GitHub のシークレットに 1 回だけ貼る
3. 公開された URL をスマホで開く

以降 `<ユーザー名>` は `aiueokakikukeko314` を指す。

> **ヒント**: Firebase コンソールも GitHub の設定画面もスマホだと項目が隠れることがある。
> 見つからないときはブラウザのメニューから「デスクトップ用サイトを表示」を有効にする。

---

## STEP 1 — リポジトリを公開にする

GitHub Pages は無料プランだと **public リポジトリでしか使えない**ため、公開に切り替える。

1. https://github.com/aiueokakikukeko314/mario-party を開く
2. **Settings** → 一番下までスクロール → **Danger Zone**
3. **Change repository visibility** → **Change to public** → 確認文を入力して実行

### 公開して大丈夫なのか

- Firebase のウェブ構成値（`apiKey` など）は**もともと秘密情報ではない**。ブラウザに配られるものなので、
  どんな作り方をしても利用者から見える。Firebase のセキュリティは構成値を隠すことではなく
  `database.rules.json`（Phase 6 で実装）で守る設計になっている。
- ただし **Realtime Database を「テストモード」で作ると、約30日間は誰でも読み書きできる**状態になる。
  この間は本名・写真など、他人に見られて困るデータを入れないこと。
- Phase 6 でルールを書いて締めるまでが前提。

---

## STEP 2 — GitHub Pages を有効にする

1. **Settings** → 左メニュー **Pages**
2. **Build and deployment** → **Source** を **GitHub Actions** に変更

これで、このリポジトリに用意済みの `.github/workflows/deploy.yml` がデプロイを担当する。

---

## STEP 3 — Firebase プロジェクトを作る

https://console.firebase.google.com/ をスマホのブラウザで開き、Google アカウントでログインする。

### 3-1. プロジェクト作成

1. **プロジェクトを追加**
2. 名前は何でもよい（例: `party-game`）
3. Google アナリティクスは **無効でよい**（不要）

### 3-2. Realtime Database を作る（先にやること）

> ⚠️ この手順を先にやらないと、あとでコピーする設定スニペットに `databaseURL` が入らず、
> ビルドが失敗する。

1. 左メニュー **構築 (Build)** → **Realtime Database**
2. **データベースを作成**
3. ロケーション: **シンガポール (asia-southeast1)**
4. セキュリティ ルール: **テストモードで開始**

### 3-3. 匿名認証を有効にする

1. 左メニュー **構築 (Build)** → **Authentication**
2. **始める**
3. **Sign-in method** タブ → **匿名 (Anonymous)** → 有効にする → 保存

### 3-4. ウェブアプリを登録して設定をコピー

1. 左上の歯車 → **プロジェクトの設定**
2. **マイアプリ** → ウェブアイコン **`</>`** をタップ
3. アプリのニックネームを入力（例: `party-game-web`）。
   「Firebase Hosting も設定する」は**チェック不要**
4. **アプリを登録**
5. 表示される次のようなコードを**まるごとコピー**する

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "party-game-xxxx.firebaseapp.com",
  databaseURL: "https://party-game-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "party-game-xxxx",
  storageBucket: "party-game-xxxx.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

`const firebaseConfig = {` から `};` まで含めてコピーして構わない。
余計な行が混ざっていても読み取れるようになっている。

> あとから見たいときは **プロジェクトの設定 → マイアプリ → 構成 (Config)** で同じものが出る。

---

## STEP 4 — GitHub にシークレットとして貼る

1. https://github.com/aiueokakikukeko314/mario-party を開く
2. **Settings** → 左メニュー **Secrets and variables** → **Actions**
3. **New repository secret**
4. **Name** に `FIREBASE_CONFIG`（この名前でないと動かない）
5. **Secret** に STEP 3-4 でコピーしたものを貼り付け
6. **Add secret**

登録するのはこの 1 個だけ。7 個の環境変数への分解はビルド時に
`scripts/write-env.mjs` が自動でやる。

---

## STEP 5 — デプロイを実行する

1. リポジトリの **Actions** タブ
2. 左メニュー **Deploy to GitHub Pages**
3. **Run workflow** → ブランチ `claude/new-session-fgopj0` → **Run workflow**
4. 2〜3 分待つ。緑のチェックが付けば成功

失敗した場合は、失敗したステップをタップするとログが読める。よくある原因:

| ログに出るメッセージ | 原因 |
|---|---|
| `FIREBASE_CONFIG が空です` | STEP 4 の Secret 名が違う（`FIREBASE_CONFIG` 以外になっている） |
| `読み取れませんでした: databaseURL` | STEP 3-2 の Realtime Database 作成前に設定をコピーした。作成後にコピーし直して Secret を更新する |
| `Get Pages site failed` | STEP 2 の Pages の Source が **GitHub Actions** になっていない |

---

## STEP 6 — 公開URLを Firebase の承認済みドメインに追加

匿名認証は、許可されたドメインからしか使えない。GitHub Pages のドメインを登録する。

1. Firebase コンソール → **Authentication** → **設定 (Settings)** タブ
2. **承認済みドメイン (Authorized domains)**
3. **ドメインを追加** → `aiueokakikukeko314.github.io`

> これを忘れると、画面に UID が出ず `auth/unauthorized-domain` というエラーが出る。

---

## STEP 7 — スマホで開く

https://aiueokakikukeko314.github.io/mario-party/

画面に

- **RTDB 接続: 接続中**（緑）
- **自分の UID: 英数字の文字列**

が出れば **Phase 0 完了**。

うまくいかないときは画面に出ているエラー文をそのまま伝えてもらえれば原因を特定できる。

---

## 以降の開発サイクル

Phase 1 以降、コードが更新されて `claude/new-session-fgopj0` に push されるたびに
Actions が自動で走り、同じ URL が更新される。
スマホ側は**ページを再読み込みするだけ**でよい。

2 台での同期テストも、2 台とも同じ URL を開けばそのままできる。
`npm run dev -- --host` で LAN 内から繋ぐ必要はない（PC を使う場合はそちらも使える）。
