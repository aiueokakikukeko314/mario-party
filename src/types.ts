/**
 * CLAUDE.md セクション4「データモデル（Realtime Database）」の TypeScript 表現。
 *
 * Realtime Database は「空のオブジェクト/配列を保存しない」ため、
 * 子が 1 つも無いノードは読み出し時に存在しない（undefined）ことがある。
 * その可能性がある箇所は optional（`?`）で表現している。
 */

/** ゲーム全体のフェーズ。画面遷移は必ずこの値に従う（CLAUDE.md セクション5）。 */
export type Phase =
  | "lobby"
  | "board"
  | "minigameIntro"
  | "minigame"
  | "minigameResult"
  | "gameEnd";

/** プレイヤーの色。参加順に 0..3 を割り当てる。 */
export type ColorIdx = 0 | 1 | 2 | 3;

/** rooms/{roomCode}/meta */
export interface RoomMeta {
  /** ホスト端末の uid。この端末だけがゲームロジックを実行する。 */
  hostId: string;
  phase: Phase;
  /** serverTimestamp で書き込まれた作成時刻(ms)。 */
  createdAt: number;
  /** 何ターンで終了するか。既定 10。 */
  maxTurns: number;
}

/** rooms/{roomCode}/players/{uid} */
export interface Player {
  name: string;
  colorIdx: ColorIdx;
  coins: number;
  stars: number;
  /** ボード上のマスのインデックス。 */
  pos: number;
  /** 手番順（0 始まり）。 */
  order: number;
  /** onDisconnect で false になる。 */
  connected: boolean;
  lastSeen: number;
}

/** rooms/{roomCode}/board */
export interface BoardState {
  /** 1 始まり。 */
  turn: number;
  /** 今の手番プレイヤーの uid。 */
  currentUid: string;
  /** 出目（表示用）。振る前は null。 */
  dice: number | null;
  /** コマ移動アニメーション中はホストが true にする。 */
  animating: boolean;
}

/** rooms/{roomCode}/minigame */
export interface MinigameState {
  /** registry に登録されたミニゲーム ID。未選出なら null。 */
  id: string | null;
  /** 開始時刻。サーバー時刻の絶対値(ms)。 */
  startAt: number | null;
  /** 終了時刻。サーバー時刻の絶対値(ms)。 */
  endAt: number | null;
  /** uid → スコア。1 人も報告していなければキーごと存在しない。 */
  scores?: Record<string, number>;
  /** 順位順の uid 配列（先頭が 1 位）。集計前は null。 */
  ranking: string[] | null;
}

/** rooms/{roomCode}/inputs/{uid} — 各プレイヤーが自分の入力だけを書き込む。 */
export interface PlayerInput {
  type: string;
  value: unknown;
  /** 送信時刻(ms)。 */
  ts: number;
}

/** rooms/{roomCode} */
export interface Room {
  meta: RoomMeta;
  /** 参加者が 0 人になるとキーごと消えるため optional。 */
  players?: Record<string, Player>;
  board?: BoardState;
  minigame?: MinigameState;
  inputs?: Record<string, PlayerInput>;
}
