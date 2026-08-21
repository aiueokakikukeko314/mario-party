import { STAR_COST } from "../constants";
import type { BoardDef } from "../board/types";

/** スターまわりの純関数。 */

export function canBuyStar(coins: number): boolean {
  return coins >= STAR_COST;
}

/** 購入後のコインとスター。買えないときは変えない。 */
export function applyStarPurchase(coins: number, stars: number): {
  coins: number;
  stars: number;
  bought: boolean;
} {
  if (!canBuyStar(coins)) return { coins, stars, bought: false };
  return { coins: coins - STAR_COST, stars: stars + 1, bought: true };
}

/**
 * 次のスター位置を選ぶ。
 * 今の位置と直前の位置は候補から外す。外すと候補が無くなる場合は
 * 今の位置だけを外し、それでも無ければ今の位置のままにする。
 * random は 0以上1未満（ホストが生成）。
 */
export function pickNextStarNode(
  board: BoardDef,
  current: number,
  previous: number | null,
  random: number,
): number {
  const all = board.starCandidates;
  if (all.length === 0) return current;

  const strict = all.filter((id) => id !== current && id !== previous);
  const loose = all.filter((id) => id !== current);
  const pool = strict.length > 0 ? strict : loose.length > 0 ? loose : all;

  const index = Math.min(pool.length - 1, Math.floor(random * pool.length));
  return pool[index] ?? current;
}
