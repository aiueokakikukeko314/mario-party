import type { Player } from "../types";

/**
 * 最終順位（CLAUDE.md セクション8）。
 * スター数 → コイン数 の順で判定する。純関数。
 */

export interface RankedPlayer {
  uid: string;
  player: Player;
  /** 1始まり。スターもコインも同じなら同順位になる */
  rank: number;
}

/** 勝敗判定に使う値が同じか。 */
function isTie(a: Player, b: Player): boolean {
  return a.stars === b.stars && a.coins === b.coins;
}

/**
 * スター→コインの順で並べ、同点は同じ順位にする。
 * 同順位が続いた分だけ次の順位は飛ぶ（1, 2, 2, 4）。
 * 完全同点のときの並び順は order（手番順）で安定させる。
 */
export function rankPlayers(
  players: Record<string, Player>,
): RankedPlayer[] {
  const sorted = Object.entries(players)
    .map(([uid, player]) => ({ uid, player }))
    .sort((a, b) => {
      if (a.player.stars !== b.player.stars) {
        return b.player.stars - a.player.stars;
      }
      if (a.player.coins !== b.player.coins) {
        return b.player.coins - a.player.coins;
      }
      return a.player.order - b.player.order;
    });

  const ranked: RankedPlayer[] = [];
  sorted.forEach((entry, index) => {
    const previous = ranked[index - 1];
    const rank =
      previous && isTie(previous.player, entry.player)
        ? previous.rank
        : index + 1;
    ranked.push({ ...entry, rank });
  });
  return ranked;
}

/**
 * 完全同点（スターもコインも同じ）の1位が複数いる場合に、
 * ホストが振ったサイコロで決着をつける。
 * tieBreak は uid → 出目。出目が大きい人が上。
 */
export function applyTieBreak(
  ranked: readonly RankedPlayer[],
  tieBreak: Record<string, number> | undefined,
): RankedPlayer[] {
  if (!tieBreak) return [...ranked];
  const sorted = [...ranked].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const rollA = tieBreak[a.uid] ?? 0;
    const rollB = tieBreak[b.uid] ?? 0;
    if (rollA !== rollB) return rollB - rollA;
    return a.player.order - b.player.order;
  });
  // 出目で差がついた分だけ順位を振り直す
  return sorted.map((entry, index) => {
    const previous = sorted[index - 1];
    if (!previous) return { ...entry, rank: 1 };
    const same =
      previous.rank === entry.rank &&
      (tieBreak[previous.uid] ?? 0) === (tieBreak[entry.uid] ?? 0);
    return { ...entry, rank: same ? index : index + 1 };
  });
}

/** 1位の人たち（同点なら複数）。 */
export function winnersOf(ranked: readonly RankedPlayer[]): RankedPlayer[] {
  return ranked.filter((entry) => entry.rank === 1);
}
