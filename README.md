# パーティゲーム

複数のスマホから同じルームに入り、すごろくとミニゲームを交互に遊ぶマリオパーティ型の Web アプリ。

設計方針は [`CLAUDE.md`](./CLAUDE.md)、開発フェーズの進め方は [`docs/phase-prompts.md`](./docs/phase-prompts.md) を参照。

## 現在の進捗

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | 雛形・Firebase 接続・型定義 | ✅ 完了 |
| 1 | ロビー | ✅ 完了 |
| 2 | すごろく | 🔵 実装済み（実機2台での確認待ち） |
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

### Phase 1（完了）

実機2台でルームコード入室し、参加者リストが両方に即反映されることを確認済み。

### Phase 2（確認待ち）

**実機2台**で行う。

1. ロビーで「ゲームを開始」→ 両方の画面が3Dボードに変わる
2. 手番の人だけ「サイコロを振る」が押せる。他は「〇〇のばん」と出る
3. **両方の端末で同じ出目・同じ移動先になること**
4. コイン/スターが上部のバーで両方の端末に同期すること
5. ★マスにコイン20枚以上で止まると「買う / やめる」が本人にだけ出る。
   他の端末には「〇〇が えらんでいます」と出て、選ぶまで進行が止まること
6. 全員が振り終わると `minigameIntro` の仮画面へ。ホストの「（仮）ミニゲームを飛ばして次のターンへ」で次ターンに戻る
7. ボードをドラッグして視点が回せること

## テスト

```bash
npm test          # src/logic の純関数のユニットテスト（Vitest）
npm run typecheck # tsc --noEmit
npm run build     # 型チェック + 本番ビルド
```

## ディレクトリ構成

```
src/
  lib/        firebase.ts, db.ts, dbGame.ts, parse.ts, time.ts, roomCode.ts
  logic/      board.ts, board.test.ts, lobby.ts  ← 純関数のみ（React 非依存）
  store/      useRoom.ts          ← ルーム購読を集約（Zustand）
  hooks/      useHost.ts          ← ホストだけが回すゲームロジック
  screens/    Home.tsx, Lobby.tsx, Board.tsx, PhasePlaceholder.tsx
  components/ PlayerCard.tsx, Board3D.tsx, boardLayout.ts, Dice.tsx,
              PlayerStatusBar.tsx
  types.ts    RTDB のデータモデル（CLAUDE.md セクション4）
  constants.ts
  App.tsx     meta.phase を見て画面を出し分けるだけ
```

`minigames/` は Phase 3 以降に追加する。
