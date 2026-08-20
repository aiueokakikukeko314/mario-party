import type { Player } from "../types";

/**
 * ボード（すごろく）の純関数（CLAUDE.md セクション8）。
 * React にも Firebase にも依存させない。乱数はここでは作らず、
 * ホストが生成した値を引数で受け取る（CLAUDE.md セクション3）。
 */

export type SquareType =
  | "plus"
  | "minus"
  | "star"
  | "minigame"
  | "warp"
  | "empty";

/** リング状の盤面。全24マス、インデックス0がスタート。 */
export const BOARD: readonly SquareType[] = [
  "empty", // 0 スタート
  "plus",
  "minus",
  "minigame",
  "plus",
  "empty",
  "star", // 6
  "minus",
  "plus",
  "warp",
  "minigame",
  "empty",
  "plus", // 12
  "minus",
  "minigame",
  "plus",
  "empty",
  "minus",
  "star", // 18
  "plus",
  "warp",
  "minigame",
  "empty",
  "minus",
];

export const BOARD_SIZE = BOARD.length;

/** plus / minus で増減するコイン枚数。 */
export const COIN_DELTA = 3;
/** スター1つの値段。 */
export const STAR_COST = 20;

export type PlayersState = Record<string, Player>;

/** マスの種類を返す。pos はリング状に丸める。 */
export function squareAt(pos: number): SquareType {
  const index = ((pos % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  // BOARD は固定長なので必ず存在するが、noUncheckedIndexedAccess 対策
  return BOARD[index] ?? "empty";
}

/**
 * そのマスに立っているとミニゲーム報酬が2倍になるか。
 * ミニゲーム中は位置が動かないため、専用のフラグを持たずに pos から判定できる。
 */
export function hasMinigameBonus(pos: number): boolean {
  return squareAt(pos) === "minigame";
}

/** サイコロの出目だけコマを進める（マス効果は適用しない）。 */
export function applyDice(
  players: PlayersState,
  uid: string,
  dice: number,
): PlayersState {
  const player = players[uid];
  if (!player) return players;
  return {
    ...players,
    [uid]: { ...player, pos: (player.pos + dice) % BOARD_SIZE },
  };
}

/** マス効果の結果。演出とログの表示に使う。 */
export interface SquareResult {
  type: SquareType;
  coinDelta: number;
  starDelta: number;
  /** warp で移動した先。移動しなければ null。 */
  movedTo: number | null;
}

/**
 * 止まったマスの効果を適用する。
 * warp の移動先はホストが乱数で決めて warpTarget として渡す。
 */
export function applySquareEffect(
  players: PlayersState,
  uid: string,
  warpTarget: number,
): { players: PlayersState; result: SquareResult } {
  const player = players[uid];
  if (!player) {
    return {
      players,
      result: { type: "empty", coinDelta: 0, starDelta: 0, movedTo: null },
    };
  }

  const type = squareAt(player.pos);
  let coinDelta = 0;
  let starDelta = 0;
  let movedTo: number | null = null;

  switch (type) {
    case "plus":
      coinDelta = COIN_DELTA;
      break;
    case "minus":
      // 0未満にはしない
      coinDelta = -Math.min(COIN_DELTA, player.coins);
      break;
    case "star":
      // 20枚払えるときだけ購入する
      if (player.coins >= STAR_COST) {
        coinDelta = -STAR_COST;
        starDelta = 1;
      }
      break;
    case "warp":
      movedTo = ((warpTarget % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
      break;
    case "minigame":
    case "empty":
      // minigame はこの時点では何もしない。
      // ミニゲームの報酬計算時に hasMinigameBonus() で2倍にする。
      break;
  }

  return {
    players: {
      ...players,
      [uid]: {
        ...player,
        coins: player.coins + coinDelta,
        stars: player.stars + starDelta,
        pos: movedTo ?? player.pos,
      },
    },
    result: { type, coinDelta, starDelta, movedTo },
  };
}

/** サイコロを振ったときにコマが通過するマスの並び（アニメーション用）。 */
export function stepPath(from: number, dice: number): number[] {
  const path: number[] = [];
  for (let i = 1; i <= dice; i++) {
    path.push((from + i) % BOARD_SIZE);
  }
  return path;
}
