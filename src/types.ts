/**
 * CLAUDE.md セクション4「データモデル（Realtime Database）」の TypeScript 表現。
 *
 * Realtime Database は「空のオブジェクト/配列を保存しない」ため、
 * 子が 1 つも無いノードは読み出し時に存在しない（undefined）ことがある。
 * その可能性がある箇所は optional（`?`）で表現している。
 */

/** ゲーム全体のフェーズ。画面レベルの大分類だけを持つ（細かい進行は board.action）。 */
export type Phase =
  | "lobby"
  | "gameSetup"
  | "board"
  | "minigameIntro"
  | "minigame"
  | "minigameResult"
  | "finalBonus"
  | "gameEnd";

/** プレイヤーの色。参加順に 0..3 を割り当てる。 */
export type ColorIdx = 0 | 1 | 2 | 3;

/** ボード内部の細かい進行状態。meta.phase を増やさずにここで表す。 */
export type BoardAction =
  | "turnStart"
  | "itemChoice"
  | "diceRoll"
  | "moving"
  | "branchChoice"
  | "passingEvent"
  | "landingEvent"
  | "playerEnd"
  | "waiting";

/** 選択待ちの種類。 */
export type DecisionType =
  | "branch"
  | "starPurchase"
  | "shop"
  | "itemChoice"
  | "itemTarget"
  | "eventChoice";

/** 入力の種類。ホストはこれ以外を無視する。 */
export type InputType =
  | "roll"
  | "decision"
  | "minigameScore"
  | "useItem"
  | "startGame";

/** rooms/{roomCode}/meta */
export interface RoomMeta {
  /** ホスト端末の uid。この端末だけがゲームロジックを実行する。 */
  hostId: string;
  /**
   * ホストが変わるたびに +1。
   * 旧ホストの engine が復帰しても、epoch 不一致で即停止させるために使う。
   */
  hostEpoch: number;
  phase: Phase;
  createdAt: number;
  updatedAt?: number;
}

/** rooms/{roomCode}/config — ホストがロビーで決める。開始後は変更しない。 */
export interface GameConfig {
  boardId: string;
  maxTurns: number;
  bonusAwardsEnabled: boolean;
  itemsEnabled: boolean;
  startingCoins: number;
}

/** 各プレイヤーの成績。ホストだけが更新する。 */
export interface PlayerStats {
  spacesMoved: number;
  minigameWins: number;
  minigameCoins: number;
  coinsEarned: number;
  coinsLost: number;
  itemsUsed: number;
  shopSpent: number;
  luckyLanded: number;
  unluckyLanded: number;
  eventLanded: number;
  starsBought: number;
}

/** 持ち物。最大3個。空きスロットはキーごと存在しない。 */
export interface Inventory {
  slot0?: string;
  slot1?: string;
  slot2?: string;
}

/** rooms/{roomCode}/players/{uid} */
export interface Player {
  name: string;
  colorIdx: ColorIdx;
  coins: number;
  stars: number;
  /** ボード上のノード id。 */
  pos: number;
  /** 手番順（0 始まり）。 */
  order: number;
  connected: boolean;
  lastSeen: number;
  inventory?: Inventory;
  stats?: PlayerStats;
  /** shield を使っていて、次のコイン減少を1回防げる状態か。 */
  shielded?: boolean;
}

/** 選択待ち。現在手番の uid だけが答えられる。 */
export interface PendingDecision {
  /** 応答の照合に使う一意 id。 */
  id: string;
  uid: string;
  type: DecisionType;
  /** 種類ごとの選択肢。branch なら次ノード id の配列など。 */
  options: unknown;
  createdAt: number;
  /** この時刻を過ぎたらホストが既定の動作で進める。 */
  timeoutAt: number;
}

/** 直前に起きたことの表示用データ。 */
export interface BoardEventLog {
  kind: string;
  uid: string;
  text: string;
  coinDelta?: number;
  starDelta?: number;
  at: number;
}

/** rooms/{roomCode}/board */
export interface BoardState {
  turn: number;
  currentUid: string;
  /** order 順の何番目か。 */
  currentOrderIndex: number;
  action: BoardAction;

  /** 振ったサイコロの各出目。 */
  diceValues?: number[];
  diceTotal: number | null;
  movesRemaining: number;

  /** 現在のスター設置ノード。 */
  starNodeId: number;
  previousStarNodeId: number | null;

  pendingDecision?: PendingDecision | null;
  lastEvent?: BoardEventLog | null;

  /** ボード固有イベントが使う可変状態。 */
  boardFlags?: Record<string, boolean | number | string>;

  /** 直近に出したミニゲーム。連続を避けるのに使う。 */
  recentMinigameIds?: string[];

  /** uid → 処理済みの最大 seq。二重処理を防ぐ。 */
  lastProcessedInputSeq?: Record<string, number>;

  /** 最終ターン付近の盛り上げ（Final Rush）が有効か。 */
  finalRush?: boolean;
}

export type MinigameMode = "ffa" | "twoVsTwo" | "oneVsThree";

/** rooms/{roomCode}/minigame */
export interface MinigameState {
  id: string | null;
  mode?: MinigameMode;
  /** 全端末で同じ問題を出すための種。 */
  seed?: number;
  startAt: number | null;
  endAt: number | null;
  /** twoVsTwo / oneVsThree のときのチーム分け。uid → チーム番号。 */
  teams?: Record<string, number>;
  scores?: Record<string, number>;
  /** uid → 提出済みか。 */
  submitted?: Record<string, boolean>;
  ranking: string[] | null;
}

/** 最終ボーナス賞の結果。 */
export interface BonusAward {
  id: string;
  title: string;
  description: string;
  winners: string[];
}

/** rooms/{roomCode}/inputs/{uid} — 各プレイヤーが自分の入力だけを書き込む。 */
export interface PlayerInput {
  /** プレイヤーごとに増える通し番号。 */
  seq: number;
  /** 何に対する応答か。pendingDecision.id などを入れる。 */
  actionId: string;
  type: InputType;
  payload: unknown;
  ts: number;
}

/** rooms/{roomCode} */
export interface Room {
  meta: RoomMeta;
  config?: GameConfig;
  players?: Record<string, Player>;
  board?: BoardState;
  minigame?: MinigameState;
  bonus?: { awards: BonusAward[]; revealed: number } | null;
  inputs?: Record<string, PlayerInput>;
}
