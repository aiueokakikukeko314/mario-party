/**
 * ミニゲームの順位付け（純関数・CLAUDE.md セクション10）。
 */

/**
 * スコアから順位順の uid 配列を作る（先頭が1位）。
 *
 * - `uids` は手番順で渡す。同点はこの順で決める（先の人が上位）
 * - スコアが無い人（未報告・離脱）は必ず最下位に置く。
 *   0 を代入すると higherIsBetter=false のゲームで最上位になってしまうため、
 *   「値が無い」ことを最下位として扱う
 */
export function computeRanking(
  uids: readonly string[],
  scores: Record<string, number> | undefined,
  higherIsBetter: boolean,
): string[] {
  const scored: { uid: string; score: number; order: number }[] = [];
  const unscored: string[] = [];

  uids.forEach((uid, order) => {
    const score = scores?.[uid];
    if (typeof score === "number" && Number.isFinite(score)) {
      scored.push({ uid, score, order });
    } else {
      unscored.push(uid);
    }
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return higherIsBetter ? b.score - a.score : a.score - b.score;
    }
    return a.order - b.order; // 同点は手番順
  });

  return [...scored.map((entry) => entry.uid), ...unscored];
}
