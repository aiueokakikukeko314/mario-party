# CLAUDE.md — パーティゲーム Web アプリ

このファイルは Claude Code が毎セッション参照する設計憲法。
**ここに書かれた決定は勝手に変えない。変更したい場合は必ずユーザーに確認する。**

---

## 1. プロダクト概要

複数のスマホから同じルームに入り、すごろく（ボード）とミニゲームを交互に遊ぶ
マリオパーティ型のパーティゲーム。全員が自分のスマホで全画面を見る（TV親機なし）。

- 想定人数: 2〜4人
- 想定端末: iOS Safari / Android Chrome（スマホ縦持ち）
- 同一空間（同じ部屋）にいる前提。ボイスチャット等は不要。

---

## 2. 技術スタック（変更禁止）

| 領域 | 採用 |
|---|---|
| ビルド | Vite |
| UI | React 18 + TypeScript (strict) |
| スタイル | Tailwind CSS |
| 状態管理 | Zustand |
| 通信/DB | Firebase Realtime Database |
| 認証 | Firebase Anonymous Auth |
| アニメーション | Framer Motion |
| 音 | Howler.js |
| PWA | vite-plugin-pwa |

**使わないもの**: Firestore（RTDB に統一）、Redux、CSS-in-JS、クラスコンポーネント。

---

## 3. 最重要アーキテクチャ: ホスト権威モデル

> **すべてのゲームロジックはホスト端末だけが実行する。**

- ルームを作成した人が `hostId`。
- ホストのみ `board` / `minigame` / `players.*.coins` などの**ゲーム状態**を書き込める。
- 他プレイヤーは `inputs/{uid}` に**自分の入力だけ**書き込む。
- ホストが `inputs` の変化を監視 → ロジック処理 → `state` を更新 → 全員に配信。
- **乱数は必ずホストが生成する。**（サイコロ、マス抽選、ミニゲーム選出すべて）

理由: 各端末が独立に計算するとデシンク（状態ズレ）が必ず起きる。単一の真実源を作る。

### ホスト判定
```ts
const isHost = myUid === room.meta.hostId;
```
ロジック関数は必ず `if (!isHost) return;` でガードする。

---

## 4. データモデル（Realtime Database）

```
rooms/{roomCode}/
  meta:
    hostId: string
    phase: "lobby" | "board" | "minigameIntro" | "minigame" | "minigameResult" | "gameEnd"
    createdAt: number        # serverTimestamp
    maxTurns: number         # 既定 10
  players/
    {uid}:
      name: string
      colorIdx: 0|1|2|3
      coins: number
      stars: number
      pos: number            # マスのインデックス
      order: number          # 手番順
      connected: boolean     # onDisconnect で false
      lastSeen: number
  board:
    turn: number             # 1始まり
    currentUid: string       # 今の手番プレイヤー
    dice: number | null      # 出目（表示用）
    animating: boolean
    pending: "star" | null   # 手番プレイヤーの選択待ち（star マスの購入確認）
  minigame:
    id: string | null
    startAt: number | null   # サーバー時刻の絶対値(ms)
    endAt: number | null
    scores/{uid}: number
    ranking: string[] | null # uid の配列（1位→）
  inputs/
    {uid}: { type: string, value: unknown, ts: number }
```

### ルームコード
4桁の英数字（紛らわしい `0 O 1 I` は除外）。`roomCode` をキーにする。

---

## 5. フェーズ状態機械

```
lobby → board → minigameIntro → minigame → minigameResult → board → ... → gameEnd
```

- **画面遷移は必ず `meta.phase` に従う。** コンポーネント内で独自に画面を切り替えない。
- `App.tsx` は `phase` を見て画面コンポーネントを出し分けるだけ。
- 遷移を起こしてよいのはホストのみ。

---

## 6. 時刻同期（必須ルール）

**端末のローカル時計は絶対に信用しない。**

```ts
// 起動時に取得
onValue(ref(db, ".info/serverTimeOffset"), snap => {
  serverOffset = snap.val() ?? 0;
});
export const serverNow = () => Date.now() + serverOffset;
```

ミニゲームは「`startAt` という**絶対時刻**に全員が同時開始」する。
`setTimeout(3000)` のような相対指定でカウントダウンを開始しない。

```ts
const startAt = serverNow() + 4000; // ホストが決めて書き込む
// 各端末: startAt - serverNow() ミリ秒後に開始
```

---

## 7. ミニゲーム設計

### 原則: ローカル完結 → スコアのみ送信
リアルタイムに座標を同期する対戦型は**作らない**（遅延とデシンクで破綻するため）。
各端末でゲームがローカルに動き、終了時にスコアだけを RTDB に書く。

### 共通インターフェース（変更禁止）
```ts
export interface MinigameDef {
  id: string;
  title: string;
  description: string;      // ルール説明（イントロ画面で表示）
  durationMs: number;
  higherIsBetter: boolean;  // スコアの大小どちらが good か
  Component: React.FC<MinigameProps>;
}

export interface MinigameProps {
  /** 残り時間(ms)。0 で終了 */
  remainingMs: number;
  /** スコアを報告する。複数回呼んでよい（最後の値が採用） */
  onScore: (score: number) => void;
}
```

新しいミニゲームは `src/minigames/{id}/index.tsx` に追加し、
`src/minigames/registry.ts` に登録するだけで動くこと。

### 初期実装する3本
1. `tap-battle` — 制限時間内の連打数
2. `timing-stop` — 動くバーを中央で止める（中心からのズレの小ささ）
3. `reflex` — 画面が変色した瞬間にタップ（反応時間）

---

## 8. マス（ボード）仕様

```ts
type SquareType = "plus" | "minus" | "star" | "minigame" | "warp" | "empty";
```
- `plus`: +3コイン / `minus`: −3コイン（0未満にはしない）
- `star`: コイン20枚を支払ってスター1つ購入。**買うかどうかは本人に確認する**（20枚未満なら確認せず素通り）
- `warp`: ランダムなマスへ移動（ホストが乱数決定）
- `minigame`: そのターンのミニゲーム報酬が2倍（1位 +20 / 2位 +10 / 3位 +4 / 4位 0）
- `empty`: 何も起きない
- ボードはリング状（1周したら先頭に戻る）、全24マス

1ターン = 全員がサイコロを振る → ミニゲーム1回。
ミニゲーム報酬: 1位 +10 / 2位 +5 / 3位 +2 / 4位 0 コイン。
`maxTurns` 終了後、スター数 → コイン数 の順で勝敗判定。

---

## 9. セキュリティルール（`database.rules.json`）

必ず以下を満たすこと:
- 匿名認証必須（`auth != null`）
- `players/{uid}` は本人のみ書き込み可（ただし coins/stars/pos はホストのみ）
- `board` / `minigame` / `meta` はホストのみ書き込み可
- `inputs/{uid}` は本人のみ書き込み可
- ルームは誰でも読める（コードを知っていれば入れる）

---

## 10. コーディング規約

- TypeScript `strict: true`。`any` 禁止（やむを得ない場合は `unknown` + 型ガード）。
- DB の読み書きは `src/lib/db.ts` の関数経由のみ。コンポーネントから直接 `ref()` を触らない。
- ゲームロジックは純関数として `src/logic/` に置き、React に依存させない（テストしやすくするため）。
- 1ファイル 250 行を超えたら分割を検討する。
- コメントは日本語でよい。

### ディレクトリ構成
```
src/
  lib/        firebase.ts, db.ts, time.ts, roomCode.ts
  logic/      board.ts, ranking.ts, reward.ts  ← 純関数のみ
  store/      useRoom.ts (Zustand)
  screens/    Lobby.tsx, Board.tsx, MinigameIntro.tsx, MinigamePlay.tsx, Result.tsx, GameEnd.tsx
  components/ Dice.tsx, PlayerCard.tsx, Countdown.tsx, ...
  minigames/  registry.ts, tap-battle/, timing-stop/, reflex/
  hooks/      useServerTime.ts, useHost.ts
```

---

## 11. モバイル対応の必須事項

- 高さは `100dvh` を使う（`100vh` は iOS でアドレスバー分ズレる）
- `touch-action: manipulation` と `user-select: none` を全体に適用（ダブルタップズーム防止）
- 音声は**ユーザーの最初のタップ以降**に初期化する（iOS の自動再生制限）
- `<meta name="viewport" content="... viewport-fit=cover, user-scalable=no">`
- セーフエリア: `env(safe-area-inset-bottom)` を下部ボタンに反映
- 画面スリープ対策に Wake Lock API（対応端末のみ、失敗は握りつぶす）

---

## 12. 切断・再接続

- 各端末は `onDisconnect(playerRef.child("connected")).set(false)` を設定する。
- 切断中プレイヤーの手番は 15 秒でホストが自動サイコロを振ってスキップ。
- **ホストが切断した場合**: `order` が最小の接続中プレイヤーに `hostId` を移譲する
  （フェーズ6で実装。それまでは「ホストが落ちたらゲーム終了」でよい）。

---

## 13. 開発フェーズ（この順序で進める）

| Phase | 内容 | 完了条件 |
|---|---|---|
| 0 | 雛形・Firebase接続・型定義 | `npm run dev` が起動し RTDB に接続できる |
| 1 | ロビー | 実機2台でルームコード入室し、参加者リストが両方に即反映 |
| 2 | すごろく | 手番制御・サイコロ・移動・マス効果が2台で同期 |
| 3 | ミニゲーム基盤 | 同時カウントダウン・スコア集計・順位表示が動く |
| 4 | ミニゲーム3本 | registry 追加だけで増やせることを確認 |
| 5 | 演出・音・PWA | 遊べる体裁になる |
| 6 | 切断・再接続・ホスト移譲 | 1台落としても続行できる |

**Phase 1 が最重要。ここで実機同期が確認できるまで先に進まない。**

---

## 14. テストの方針

- `src/logic/` の純関数には Vitest でユニットテストを書く（サイコロ以外は決定的）。
- 同期の確認は**必ず実機**で行う。`npm run dev -- --host` で LAN 内スマホから接続。
- PCブラウザのタブ複数では見つからないバグ（タッチ、音、dvh）があるため過信しない。

---

## 15. Claude Code への恒久的な指示

- **大きな変更の前に必ず計画を提示し、承認を得てから実装する。**
- 一度に複数フェーズを進めない。1フェーズずつ、動作確認を挟む。
- 実装後は必ず `npx tsc --noEmit` と `npm run build` を通す。
- Firebase の API キー等は `.env.local` に置き、`.gitignore` に入れる。コードに直書きしない。
- 不明な仕様は推測で実装せず、質問する。
- このファイル（CLAUDE.md）の記述と矛盾する実装をしそうになったら、実装前に指摘する。
