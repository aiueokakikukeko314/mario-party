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
    hostEpoch: number       # ホストが変わるたび +1
    phase: Phase
    createdAt / updatedAt: number
  config:                   # ホストがロビーで決める。開始後は変えない
    boardId / maxTurns / bonusAwardsEnabled / itemsEnabled / startingCoins
  players/{uid}:
    name / colorIdx / order / connected / lastSeen
    coins / stars / pos     # ホストのみ書き込み可
    inventory: { slot0?, slot1?, slot2? }
    stats: { spacesMoved, minigameWins, minigameCoins, coinsEarned,
             coinsLost, itemsUsed, shopSpent, luckyLanded,
             unluckyLanded, eventLanded, starsBought }
    shielded?: boolean
  board:
    turn / currentUid / currentOrderIndex
    action: BoardAction     # 画面内の細かい進行
    diceValues[] / diceTotal / movesRemaining
    starNodeId / previousStarNodeId
    pendingDecision: PendingDecision | null
    lastEvent / boardFlags / recentMinigameIds
    lastProcessedInputSeq/{uid}: number
    finalRush: boolean
  minigame:
    id / mode / seed / startAt / endAt / teams / scores / submitted / ranking
  bonus: { awards[], revealed }
  inputs/{uid}: { seq, actionId, type, payload, ts }
```

### ルームコード
4桁の英数字（紛らわしい `0 O 1 I` は除外）。`roomCode` をキーにする。

## 5. フェーズ状態機械

`meta.phase` は**画面レベルの大分類だけ**を持つ。

```
lobby → gameSetup → board → minigameIntro → minigame → minigameResult
      → board → ... → finalBonus → gameEnd
```

ボード内部の細かい進行は `board.action` に持たせ、`meta.phase` を増やさない。

```
turnStart → itemChoice → diceRoll → moving
          → branchChoice / passingEvent → landingEvent → playerEnd
```

- **画面遷移は必ず `meta.phase` に従う。**
- 遷移を起こしてよいのはホストのみ。

### 選択待ち（PendingDecision）

分岐・スター購入・ショップ・アイテムはすべて `board.pendingDecision` に統一する。
現在手番の uid だけが答えられる。**必ず `timeoutAt` を持たせ、
時間切れ・切断時はホストが既定の動作で進める**（ゲーム全体を止めない）。

### 入力プロトコル

```ts
inputs/{uid} = { seq, actionId, type, payload, ts }
```

- プレイヤーは送るたびに `seq` を増やす
- ホストは `seq <= lastProcessedInputSeq[uid]` の入力を無視する
- `decision` は現在の `pendingDecision.id` と `actionId` が一致するものだけ受理

これで二重タップ・再接続後の古い入力・遅延入力を二重処理しない。

### ホスト移譲（hostEpoch）

ホストが変わるたび `meta.hostEpoch` を +1 する。
ホストのエンジンは起動時の epoch を保持し、DB 側と食い違ったら**即停止**する。
旧ホストが復帰しても古いエンジンが処理を続けないようにするため。

### 書き込み

複数の場所を変えるときは `set()` を並べず、
**1回の `update()`（multi-location update）**でまとめて書く。
途中の状態が他端末に見えるのを防ぐため。`src/lib/dbGame.ts` の
`applyRoomUpdate()` を使う。

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

## 8. ボード仕様

ボードは**リングではなくグラフ**。`src/board/boards/` に定義する。

```ts
interface BoardNode {
  id: number; x: number; y: number; z?: number;
  type: "start" | "plus" | "minus" | "lucky" | "unlucky"
      | "event" | "item" | "warp" | "empty";
  next: number[];                       // 1つなら自動、2つ以上で分岐
  facility?: "star" | "shop" | "gate";
  eventId?: string; warpTo?: number;
}
```

- `next.length >= 2` なら**本人だけ**がルートを選ぶ。他端末は待機表示
- **移動は1マスずつ**。サイコロの結果を一気に適用しない
- 分岐・通過イベントに達したら処理を止めて入力を待つ

### マス効果

`plus` +3 / `minus` −3（0未満にしない）/ `lucky` 良イベント /
`unlucky` 悪イベント / `item` アイテム入手 / `warp` 移動 /
`event` ボード固有イベント / `empty` なし。

### スター（動的）

固定位置ではなく `starCandidates` から抽選する。
通過・着地時に20コイン以上なら**本人に購入確認**。
購入後は現在位置と直前の位置を除いて再抽選する。

### アイテム / ショップ

持ち物は最大3個。`src/board/items/registry.ts` に登録するだけで増やせる。
ショップは `facility: "shop"` のノード。品ぞろえはホストが決めた種から
決定的に決まるので全端末で一致する。

### 報酬

ミニゲーム: 1位 +10 / 2位 +5 / 3位 +2 / 4位 0（`src/constants.ts`）。
終盤（残り3ターン）は Final Rush で倍率がかかる。
`maxTurns` 終了後、ボーナススター → スター数 → コイン数 の順で勝敗判定。
完全同点はホストが振るタイブレークのサイコロで決める。

## 9. セキュリティルール（`database.rules.json`）

必ず以下を満たすこと:
- 匿名認証必須（`auth != null`）
- ルームは誰でも読める（コードを知っていれば入れる）
- プレイヤー本人が書けるのは **name（ロビー中のみ）/ connected / lastSeen /
  自分の inputs** だけ
- `coins` `stars` `pos` `order` `colorIdx` `inventory` `stats` `shielded`
  はホストのみ
- `meta` `config` `board` `minigame` `bonus` はホストのみ。
  ただし `meta/hostId` は「今のホストが切断中」のときだけ引き継ぎを許可
- `inputs/{uid}` は `$uid === auth.uid` 必須。型・文字数・数値範囲を検証

**注意**: RTDB では親で許可した `.write` が子へカスケードするため、
子の `.write` では制限できない。本人に書かせたくない項目は
`.validate` で縛ること（`.validate` は常に評価される）。

変更したら必ず検証してから適用する。

```bash
npx firebase emulators:start --only database --project demo-party
node scripts/test-rules.mjs
```

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
