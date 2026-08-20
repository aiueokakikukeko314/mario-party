# Claude Code 指示書 — パーティゲームアプリ

`CLAUDE.md` をプロジェクトルートに置いた上で、以下を上から順に投げる。
**1プロンプト＝1フェーズ。動作確認が終わるまで次に進まない。**

---

## 事前準備（自分でやる）

1. Firebase コンソールで新規プロジェクト作成
2. Realtime Database を作成（ロケーション: `asia-southeast1`）、**テストモード**で開始
3. Authentication → Sign-in method → **匿名**を有効化
4. プロジェクト設定からウェブアプリの構成値をコピー

```bash
mkdir party-game && cd party-game
# CLAUDE.md をここに配置
claude
```

---

## Phase 0 — 雛形と型定義

```
CLAUDE.md を読んでから作業を始めてください。

Phase 0 をやります。実装内容:

1. Vite + React + TypeScript(strict) でプロジェクトを初期化
2. Tailwind CSS, Zustand, Firebase, Framer Motion を導入
3. CLAUDE.md セクション4 のデータモデルを src/types.ts に TypeScript の型として定義
4. src/lib/firebase.ts — .env.local から設定を読んで初期化、匿名サインイン
5. src/lib/time.ts — serverTimeOffset を購読して serverNow() を提供
6. src/lib/roomCode.ts — 紛らわしい文字を除いた4桁コード生成
7. .env.local.example と .gitignore
8. App.tsx は「接続状態と自分のUIDを表示するだけ」の確認用画面

Phase 1 以降には手を付けないでください。
最後に npx tsc --noEmit と npm run build を通してください。
```

確認: `.env.local` に自分の値を入れて `npm run dev` → UID が表示されればOK。

---

## Phase 1 — ロビー（最重要）

```
Phase 1: ロビーを実装します。実装前に方針を箇条書きで示してください。

要件:
- ホーム画面: 名前入力 →「ルームを作る」「コードで参加」
- ルーム作成: 4桁コード生成、meta.hostId に自分、phase="lobby"
- 参加: コード入力 → 存在チェック → players/{uid} を書き込み
- ロビー画面: 参加者一覧をリアルタイム表示（名前・色・ホスト表示）
- 満員(4人)・存在しないコードのエラー処理
- onDisconnect で connected=false を設定
- ホストにのみ「ゲーム開始」ボタン（2人以上で有効）。押すと phase="board"
- DB アクセスは src/lib/db.ts 経由。購読は Zustand ストア src/store/useRoom.ts に集約
- CLAUDE.md セクション11 のモバイル対応（100dvh、タップ拡大防止等）を最初から適用

ボードやミニゲームはまだ作らないでください。
```

**確認（必ず実機2台で）:**
```bash
npm run dev -- --host
```
表示された `http://192.168.x.x:5173` にスマホからアクセス。
- 片方でルーム作成 → もう片方でコード入力 → **両方の画面に即座に2人表示されるか**
- ブラウザを閉じると相手側で connected が false になるか

ここが動かないうちに先へ進むと後で全部壊れます。

---

## Phase 2 — すごろく

```
Phase 2: ボード（すごろく）を実装します。実装前に計画を提示してください。

- src/logic/board.ts に純関数として実装（React 非依存）
  - ボード定義: 24マスのリング。CLAUDE.md セクション8 のマス種別
  - applyDice(state, uid, dice) → 新しい state
  - applySquareEffect(state, uid) → 新しい state
- ホストのみロジックを実行。全ての乱数はホストが生成
- 手番プレイヤーだけサイコロボタンが押せる。他は「〇〇のばん」表示
- サイコロは inputs/{uid} に {type:"roll"} を書き、ホストが受けて出目を決定
- コマ移動は Framer Motion で1マスずつアニメーション（board.animating で制御）
- 全員が振り終わったら phase="minigameIntro" に遷移（中身は次フェーズなので仮画面でよい）
- 画面上部に全員のコイン/スターを常時表示
- src/logic/board.ts に Vitest でユニットテストを書く
```

確認: 2台でサイコロ → 両方で同じ出目・同じ位置になるか。コインが同期するか。

---

## Phase 3 — ミニゲーム基盤

```
Phase 3: ミニゲームの基盤を作ります。ゲーム本体はまだ1本だけ。

- CLAUDE.md セクション7 の MinigameDef / MinigameProps を src/minigames/types.ts に定義
- src/minigames/registry.ts — 登録された定義の配列とID検索
- ホストがランダムに1本選び、minigame.id と startAt(=serverNow()+5000) を書く
- MinigameIntro: ルール説明を表示し、startAt に向けて 3-2-1 カウントダウン
  → serverNow() を基準にすること。setTimeout の相対時間で組まない
- MinigamePlay: remainingMs を渡して Component を描画。時間切れで onScore の最終値を
  minigame.scores/{uid} に書き込む
- ホストは全員のスコアが揃うか、endAt+3秒を過ぎたら ranking を計算 → phase="minigameResult"
- MinigameResult: 順位とコイン報酬をアニメーション表示 → 3秒後ホストが phase="board"
- 動作確認用に tap-battle（連打数カウント）だけ実装

複数端末で「同時に」開始することが最重要要件です。
```

確認: 2台を並べて、カウントダウンと開始タイミングが目視でズレていないか。

---

## Phase 4 — ミニゲーム追加

```
Phase 4: ミニゲームを2本追加します。registry への登録のみで動くこと。

1. timing-stop: 左右に往復するバーを1回タップで止める。中央からのズレが小さいほど高得点
   （higherIsBetter: false）。3回の合計で判定
2. reflex: ランダムな待機(1〜4秒)後に画面が変色。タップまでのミリ秒。
   フライング(変色前タップ)は +2000ms のペナルティ。3回の平均

既存ファイルは registry.ts 以外変更しないでください。
変更が必要になった場合は理由を説明してから提案してください。
```

`registry.ts` 以外に手が入ったら基盤設計が悪いということなので、そこで直す。

---

## Phase 5 — 演出・音・PWA

```
Phase 5: 遊べる体裁に仕上げます。

- Howler.js で効果音（サイコロ、コイン、カウントダウン、勝利）
  ※ 音声コンテキストは最初のユーザータップで初期化すること（iOS 制限）
- 画面遷移トランジション（Framer Motion）
- 最終結果画面: スター→コインの順で順位付け、1位を大きく演出
- vite-plugin-pwa でインストール可能に。アイコンとマニフェスト
- Wake Lock API で画面スリープ防止（失敗時は握りつぶす）
- 全画面で iOS Safari の実機確認前提のスタイル調整
```

---

## Phase 6 — 堅牢化

```
Phase 6: 切断とエラーに強くします。

- 切断中プレイヤーの手番は15秒でホストが自動サイコロ → スキップ
- ホスト切断時: order が最小の接続中プレイヤーへ hostId を移譲
  （複数端末が同時に移譲しようとしないよう transaction を使う）
- ミニゲーム中に離脱した人はスコア0で確定
- database.rules.json を CLAUDE.md セクション9 の通りに書き、
  firebase deploy --only database の手順を README に記載
- リロードしても同じ UID で同じルームに復帰できるようにする
```

---

## よく効く追加プロンプト

**設計がブレてきたら**
```
CLAUDE.md を読み直して、現在の実装が矛盾している箇所を列挙してください。修正はまだしないで。
```

**バグったら**
```
再現手順: (書く)
期待: (書く) / 実際: (書く)
まず原因の仮説を3つ挙げて、確認方法を示してください。修正は原因を特定してから。
```

**肥大化してきたら**
```
src/ 配下で250行を超えるファイルを列挙し、分割案を提案してください。実装はまだしないで。
```

**同期が怪しいとき**
```
ホスト権威モデルが破れている箇所（ホスト以外がゲーム状態を書いている、
または端末ごとに乱数を生成している箇所）を全て探して報告してください。
```

---

## 進め方のコツ

- **フェーズごとに git commit する**。壊れたら戻れる状態を保つ。
- Claude Code に「計画を出して」と言ってから実装させると、ズレたときの手戻りが小さい。
- 実機テストは毎フェーズやる。PCのタブ2枚では発見できない不具合が確実にある。
- 学校の iPad で遊ぶ場合、Vercel は ISGC で弾かれる。その場合は
  `vite-plugin-singlefile` で単一 HTML にまとめて GAS 配信に切り替える
  ——ただし Firebase への通信自体も弾かれる可能性があるので、先に iPad で
  Firebase の疎通だけ確認しておくこと。
