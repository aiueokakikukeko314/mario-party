/**
 * ミニゲームのコイン報酬（純関数・CLAUDE.md セクション8）。
 */

/** 通常の報酬。1位 +10 / 2位 +5 / 3位 +2 / 4位 0。 */
export const REWARDS: readonly number[] = [10, 5, 2, 0];

/**
 * minigame マスに止まっていた人の報酬（2倍）。
 * 1位 +20 / 2位 +10 / 3位 +4 / 4位 0。
 */
export const BONUS_REWARDS: readonly number[] = [20, 10, 4, 0];

/** 順位（0始まり）と2倍かどうかから報酬を返す。 */
export function rewardFor(rankIndex: number, doubled: boolean): number {
  const table = doubled ? BONUS_REWARDS : REWARDS;
  if (rankIndex < 0) return 0;
  return table[rankIndex] ?? 0;
}

/**
 * 順位表から uid ごとの報酬を計算する。
 * `doubledUids` は minigame マスに止まっていた人の集合。
 */
export function computeRewards(
  ranking: readonly string[],
  doubledUids: ReadonlySet<string>,
): Record<string, number> {
  const rewards: Record<string, number> = {};
  ranking.forEach((uid, rankIndex) => {
    rewards[uid] = rewardFor(rankIndex, doubledUids.has(uid));
  });
  return rewards;
}
