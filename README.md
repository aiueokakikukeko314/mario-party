# パーティゲーム

複数のスマホから同じルームに入り、すごろくとミニゲームを交互に遊ぶマリオパーティ型の Web アプリ。

設計方針は [`CLAUDE.md`](./CLAUDE.md)、開発フェーズの進め方は [`docs/phase-prompts.md`](./docs/phase-prompts.md) を参照。

## 現在の進捗

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | 雛形・Firebase 接続・型定義 | ✅ 完了 |
| 1 | ロビー | 🔵 実装済み（実機2台での確認待ち） |
| 2 | すごろく | 未着手 |
| 3 | ミニゲーム基盤 | 未着手 |
| 4 | ミニゲーム3本 | 未着手 |
| 5 | 演出・音・PWA | 未着手 |
| 6 | 切断・再接続・ホスト移譲 | 未着手 |

## セットアップ

### スマホだけで進める場合（推奨・PC不要）

GitHub Actions がビルドして GitHub Pages に自動デプロイする構成になっている。
手順は **[docs/setup-mobile.md](./docs/setup-mobile.md)** を参照。

公開URL: https://aiueokakikukeko314.github.io/mario-party/

`claude/new-session-fgopj0` に push するたび自動で更新されるので、
スマホ側はページを再読み込みするだけでよい。2台での同期テストも同じURLを開くだけ。

### PC で開発する場合

#### 1. Firebase 側の準備

1. Firebase コンソールで新規プロジェクトを作成
2. Realtime Database を作成（ロケーション: `asia-southeast1`）、**テストモード**で開始
3. Authentication → Sign-in method → **匿名**を有効化
4. プロジェクト設定 → ウェブアプリの構成値をコピー

#### 2. 環境変数

```bash
cp .env.local.example .env.local
# .env.local に Firebase の構成値を記入する
```

`.env.local` は `.gitignore` 済み。API キーをコードに直書きしないこと。

#### 3. 起動

```bash
npm install
npm run dev
```

実機で確認する場合は LAN 内から接続する:

```bash
npm run dev -- --host
# 表示された http://192.168.x.x:5173 にスマホからアクセス
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + 本番ビルド |
| `npm run typecheck` | `tsc --noEmit` のみ |
| `npm run preview` | ビルド結果の確認 |

## 動作確認

### Phase 0（完了）

画面に「RTDB 接続: 接続中」と自分の UID が表示されること。

### Phase 1（確認待ち）

**実機2台**で行う。スマホ2台でなくても、通常タブ＋プライベートタブでも可
（プライベートタブには別の匿名 UID が振られるため、別人として参加できる）。

1. 1台目: なまえを入れて「ルームを作る」→ 4桁コードが表示される
2. 2台目: なまえを入れて「コードで参加」→ コードを入力
3. **両方の画面に即座に2人が表示されること**（これが Phase 1 の完了条件）
4. 2台目のブラウザを閉じる → 1台目の一覧でその人が「切断中」になること
5. ホスト側にだけ「ゲームを開始」ボタンがあり、2人以上で押せること

## ディレクトリ構成

```
src/
  lib/        firebase.ts, db.ts, parse.ts, time.ts, roomCode.ts
  logic/      lobby.ts            ← 純関数のみ（React 非依存）
  store/      useRoom.ts          ← ルーム購読を集約（Zustand）
  screens/    Home.tsx, Lobby.tsx, PhasePlaceholder.tsx
  components/ PlayerCard.tsx
  types.ts    RTDB のデータモデル（CLAUDE.md セクション4）
  constants.ts
  App.tsx     meta.phase を見て画面を出し分けるだけ
```

`minigames/` `hooks/` と `logic/board.ts` は Phase 2 以降に追加する。
