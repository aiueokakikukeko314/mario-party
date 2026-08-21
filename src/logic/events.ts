import { COIN_DELTA } from "../constants";

/**
 * マス効果の純関数。
 * 乱数はホストが作った 0以上1未満の値を受け取るだけ。
 */

export interface SpaceOutcome {
  coinDelta: number;
  /** 全員に配る／他人から奪うなど、相手が絡む効果 */
  transferToOthers?: number;
  giveItem?: boolean;
  loseItem?: boolean;
  /** 次のサイコロに足す */
  nextDiceBonus?: number;
  text: string;
}

/** ラッキーマスの内容。 */
export function luckyOutcome(random: number): SpaceOutcome {
  const table: SpaceOutcome[] = [
    { coinDelta: 5, text: "コインを 5 まい ひろった！" },
    { coinDelta: 10, text: "コインを 10 まい ひろった！" },
    { coinDelta: 0, giveItem: true, text: "アイテムを 見つけた！" },
    { coinDelta: 0, nextDiceBonus: 2, text: "つぎの サイコロが +2！" },
    { coinDelta: 8, text: "コインを 8 まい ひろった！" },
  ];
  const index = Math.min(table.length - 1, Math.floor(random * table.length));
  return table[index] ?? { coinDelta: 0, text: "なにも おきなかった" };
}

/** アンラッキーマスの内容。 */
export function unluckyOutcome(random: number): SpaceOutcome {
  const table: SpaceOutcome[] = [
    { coinDelta: -5, text: "コインを 5 まい おとした…" },
    { coinDelta: 0, loseItem: true, text: "アイテムを ひとつ なくした…" },
    { coinDelta: 0, transferToOthers: 3, text: "みんなに 3 コインずつ あげた…" },
    { coinDelta: -8, text: "コインを 8 まい おとした…" },
  ];
  const index = Math.min(table.length - 1, Math.floor(random * table.length));
  return table[index] ?? { coinDelta: 0, text: "なにも おきなかった" };
}

/** plus / minus の増減。Final Rush 中は倍率がかかる。 */
export function plainCoinDelta(
  kind: "plus" | "minus",
  multiplier: number,
): number {
  return (kind === "plus" ? COIN_DELTA : -COIN_DELTA) * multiplier;
}
