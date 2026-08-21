# パーティゲーム

複数のスマホから同じルームに入り、すごろくとミニゲームを交互に遊ぶマリオパーティ型の Web アプリ。

設計方針は [`CLAUDE.md`](./CLAUDE.md)、開発フェーズの進め方は [`docs/phase-prompts.md`](./docs/phase-prompts.md) を参照。

## できること

- 2〜4人でルームに入り、すごろく＋ミニゲームを交互に遊ぶ
- **分岐のあるグラフボード**（近道あり）。1マスずつ進み、分岐は本人が選ぶ
- **動的なスター**（買うたびに場所が変わる）
- **アイテム8種とショップ**
- lucky / unlucky / item / warp / ボード固有イベント
- **ミニゲーム11本**（個人戦。2vs2 / 1vs3 の基盤も実装済み）
- 統計と**最終ボーナススター**、最終順位
- 切断時の自動進行・**ホスト移譲**・リロード復帰
- 効果音・PWA・画面スリープ防止

## 設計のポイント

| | |
|---|---|
| ホスト権威 | 乱数もロジックもホストだけ。他端末は `inputs` を送るだけ |
| 入力の二重処理防止 | `seq` と `actionId` で古い入力・二重タップを弾く |
| ホスト移譲 | `hostEpoch` を上げ、旧ホストのエンジンを止める |
| 書き込み | 複数パスは1回の `update()` にまとめる |
| ミニゲーム同期 | `startAt` の絶対時刻で全員同時開始 |
| 出題の共通化 | 種から決定的に生成。通信は増やさない |

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
| `npm run typecheck` | 型チェックのみ |
| `npm run preview` | ビルド結果の確認 |

## 動作確認

### Phase 0（完了）

画面に「RTDB 接続: 接続中」と自分の UID が表示されること。

### Phase 1（完了）

実機2台でルームコード入室し、参加者リストが両方に即反映されることを確認済み。

### Phase 2（完了）

**実機2台**で行う。

1. ロビーで「ゲームを開始」→ 両方の画面が3Dボードに変わる
2. 手番の人だけ「サイコロを振る」が押せる。他は「〇〇のばん」と出る
3. **両方の端末で同じ出目・同じ移動先になること**
4. コイン/スターが上部のバーで両方の端末に同期すること
5. ★マスにコイン20枚以上で止まると「買う / やめる」が本人にだけ出る。
   他の端末には「〇〇が えらんでいます」と出て、選ぶまで進行が止まること
6. 全員が振り終わると `minigameIntro` の仮画面へ。ホストの「（仮）ミニゲームを飛ばして次のターンへ」で次ターンに戻る
7. ボードをドラッグして視点が回せること

### Phase 3（完了）

**2台を並べて**行う。ここは「同時に始まること」が最重要。

1. 全員がサイコロを振り終わると、ルール説明と 5→1 のカウントダウンが出る
2. **2台のカウントダウンと開始タイミングが目視でズレていないこと**（最重要）
3. 5秒間タップして、それぞれの端末で連打数が増える
4. 終了後、両方の端末に同じ順位・同じコイン報酬が表示される
5. ミニゲームのマスに止まっていた人だけ報酬が2倍（1位+20 / 2位+10 / 3位+4）
6. 3秒後に次のターンのボードへ戻り、コインが増えていること

片方の端末をわざと遅れて開いても、開始時刻は揃う（`startAt` の絶対時刻で
開始しているため）。

### Phase 4（確認待ち）

ミニゲームは3本からランダムに選ばれる。何度かターンを回して3本とも出るか見る。

| ID | タイトル | 内容 | 長さ | 判定 |
|---|---|---|---|---|
| `tap-battle` | れんだバトル | 連打数 | 5秒 | 多いほど |
| `whack-mole` | もぐらたたき | モグラを叩く。💣は−1点 | 9秒 | 多いほど |
| `dodge` | よけろ！ | 落ちてくる岩をよける。安全は毎回1レーン | 11秒 | よけた数 |
| `timing-stop` | ぴったりストップ | 動くバーを中央で止める×3 | 12秒 | ズレ合計が小さいほど |
| `reflex` | はんしゃしんけい | 変色後の反応速度×3。フライング+2000ms | 13秒 | 平均が小さいほど |
| `just-stop` | ちょうどストップ | 時計を見ずに◯秒で止める×2 | 14秒 | ズレ合計が小さいほど |
| `cup-shuffle` | どれかな？ | コイン入りカップを目で追う×3 | 15秒 | 正解数 |
| `odd-one` | ちがうのどれ？ | 1つだけ違う絵を探す | 15秒 | 正解数 |
| `balloon` | ふうせんチキン | 膨らませるほど高得点。割れたら0 | 15秒 | 合計サイズ |
| `memory-touch` | おぼえてタッチ | 光った順を再現。正解で1つ増える | 16秒 | 到達した長さ |
| `ice-stop` | つるつるゴール | 氷を滑ってゴールでぴったり止まる×3 | 16秒 | ズレ合計が小さいほど |

同じゲームが2ターン続けて出ないよう、ホストは直前のIDを除外して抽選する。
1本あたりの占有率は 3.5〜11.3% で、偏りが出ないようにしてある。

`whack-mole` / `cup-shuffle` / `memory-touch` / `dodge` / `odd-one` / `balloon` は
出題内容を `remainingMs` から決定的に決めるので、**全員がまったく同じ問題を解く**
（`src/minigames/shared/random.ts`）。通信は増やしていない。

1. 3本とも2台で同時に開始し、同じルール説明が出る
2. `timing-stop`: 3回とも止められ、ズレの合計が表示される
3. `reflex`: 変色前にタップすると「フライング！ +2000 ms」が出る
4. どのゲームでも、両方の端末に同じ順位が出る

**時間切れになっても不利にならないこと**: `timing-stop` と `reflex` は
スコアが小さいほど良いため、途中でやめた人が有利にならないよう、
未挑戦のラウンドは最悪値（ズレ100 / 3000ms）として数えている。

### Phase 5（確認待ち）

1. **音**: 最初のタップ以降、サイコロ・コイン・カウントダウン・勝利で音が鳴る
   （iOS は最初のタップ前に鳴らせないため、そこで初期化している）
2. 右上の 🔊 で消音でき、次に開いたときも設定が残る
3. 画面が切り替わるときにフェードすること
4. 10ターン終わると最終結果画面が出て、1位が大きく表示されること
5. 遊んでいる間、画面が自動で暗くならないこと（Wake Lock。非対応端末では無効）
6. iOS Safari の共有 → 「ホーム画面に追加」でインストールでき、
   アドレスバーなしで起動すること

### Phase 6（確認待ち）

2台で遊びながら、片方をわざと切る。

1. 手番の人が離脱 → **15秒で自動でサイコロが振られて進む**
2. ミニゲーム中に離脱 → その人を待たずに集計され、順位は最下位になる
3. **ホストが離脱 → 6秒後に残った人がホストを引き継いでゲームが続く**
4. ページを再読み込み → **同じ席に戻る**（ホームに戻らない）
5. 部屋が消えていた場合は、ホームに戻って新しく作れる

## セキュリティルール

`database.rules.json` が CLAUDE.md セクション9 の内容。**最初は「テストモード」
（誰でも読み書き可能）なので、必ずこれを適用すること。**

### スマホから適用する（推奨）

1. [Realtime Database → ルール](https://console.firebase.google.com/project/_/database/rules)
2. 表示されている内容を、`database.rules.json` の中身で**まるごと置き換える**
3. **公開**

うまく動かなくなったら、いったん下のテストモードに戻せば元に戻る。

```json
{ "rules": { ".read": true, ".write": true } }
```

### PC から適用する

```bash
npx firebase deploy --only database
```

### ルールの検証

ルールを変更したら、必ずエミュレータで確かめてから適用する。

```bash
# 端末A: エミュレータを起動
npx firebase emulators:start --only database --project demo-party

# 端末B: ルールを検証（33件）
node scripts/test-rules.mjs
```

「ホストだけが coins を書ける」「他人になりすまして入力できない」「ホストが
切断したときだけ引き継げる」などを実際に試して確かめている。
ここを通さずに適用すると、**参加すらできなくなる**ことがある
（実際に、参加者が自分の席を作れないルールを書いてしまい、
このテストで見つけた）。

## 音とアイコンの作り方

外部から素材を持ってこなくて済むよう、どちらもスクリプトで生成している。
変更したいときはスクリプトを編集して再生成する。

```bash
node scripts/make-sounds.mjs   # public/sounds/*.wav を作り直す
node scripts/make-icons.mjs    # public/icons/*.png を作り直す
```

- 音は単純な波形の合成（`scripts/make-sounds.mjs`）
- アイコンは zlib だけで PNG を組み立てている（`scripts/make-icons.mjs`）

## ミニゲームの追加方法

`src/minigames/{id}/index.tsx` を作り、`MinigameDef` を default export して
`src/minigames/registry.ts` の `MINIGAMES` 配列に足すだけ。
他のファイルは変更しないこと。

```tsx
const def: MinigameDef = {
  id: "my-game",
  title: "ゲーム名",
  description: "ルール説明",
  durationMs: 5000,
  higherIsBetter: true,   // スコアは大きい方が良いか
  Component: MyGame,      // (remainingMs, onScore) を受け取る
};
export default def;
```

## テスト

```bash
npm test          # src/logic の純関数のユニットテスト（Vitest）
npm run typecheck # tsc --noEmit
npm run build     # 型チェック + 本番ビルド
```

## 型チェックについての注意

`tsconfig.json` はプロジェクト参照（`files: []` + `references`）なので、
**素の `npx tsc --noEmit` は何もチェックしない**（ルートの0ファイルだけを見る）。
必ず `npm run typecheck` を使うこと。中身は各プロジェクトを個別に指定している。

```bash
tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json
```

これに気づかず、import 漏れが本番まで通ってしまったことがある。

## ディレクトリ構成

```
src/
  board/      boards/ items/ events/ registry.ts   ← ボード・アイテム定義
  logic/      board, movement, items, shop, star, events,
              ranking, reward, result, bonus, minigame, input
              ← 純関数のみ。React にも Firebase にも依存しない
  host/       hostEngine, gameSetup, turnFlow, movement, landing,
              decisions, turnEnd, minigameEngine, bonusEngine
              ← ホストだけが動かす進行ロジック
  lib/        firebase, db, dbGame, parse, time, roomCode, sound, hostTiming
  store/      useRoom.ts (Zustand)
  screens/    Home, Lobby, Board, Minigame, MinigameResult,
              FinalBonus, GameEnd
  components/ Board3D, DecisionPanel, Dice, PlayerCard, PlayerStatusBar
  minigames/  registry.ts + 11本
  hooks/      useServerTime, useHostHandover, useWakeLock
```

## 拡張のしかた

| したいこと | さわる場所 |
|---|---|
| ミニゲームを足す | `src/minigames/{id}/` を作って `registry.ts` に追加 |
| アイテムを足す | `src/board/items/registry.ts` の配列に追加 |
| ボードを足す | `src/board/boards/` に作って `src/board/registry.ts` に追加 |
| イベントを足す | `src/board/events/registry.ts` に追加 |
| ルールの数値を変える | `src/constants.ts` |
