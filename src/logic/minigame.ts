import {
  MINIGAME_BONUS_REWARDS,
  MINIGAME_REWARDS,
  SOLO_WIN_COINS,
  TEAM_DRAW_COINS,
  TEAM_WIN_COINS,
  TRIO_WIN_COINS,
} from "../constants";
import type { MinigameMode } from "../types";

/** ミニゲームのチーム分けと報酬の純関数。 */

/**
 * チーム分けを決める。
 * - ffa: チーム無し
 * - twoVsTwo: 手番順で 0,2 と 1,3 に分ける
 * - oneVsThree: soloIndex の人だけチーム0、残りチーム1
 * 戻り値は uid → チーム番号。
 */
export function assignTeams(
  orderedUids: readonly string[],
  mode: MinigameMode,
  soloIndex = 0,
): Record<string, number> {
  const teams: Record<string, number> = {};
  if (mode === "ffa") return teams;

  if (mode === "twoVsTwo") {
    orderedUids.forEach((uid, index) => {
      teams[uid] = index % 2;
    });
    return teams;
  }

  const solo = orderedUids[soloIndex % Math.max(1, orderedUids.length)];
  orderedUids.forEach((uid) => {
    teams[uid] = uid === solo ? 0 : 1;
  });
  return teams;
}

/** そのモードで遊べる人数か。 */
export function supportsPlayerCount(
  mode: MinigameMode,
  count: number,
): boolean {
  if (mode === "twoVsTwo") return count === 4;
  if (mode === "oneVsThree") return count === 4;
  return count >= 2;
}

/** チームごとの合計スコア。 */
export function teamTotals(
  teams: Record<string, number>,
  scores: Record<string, number> | undefined,
): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const [uid, team] of Object.entries(teams)) {
    totals[team] = (totals[team] ?? 0) + (scores?.[uid] ?? 0);
  }
  return totals;
}

/**
 * 個人戦の報酬。順位（0始まり）と、minigame マス扱いかどうか。
 * multiplier は Final Rush 用。
 */
export function ffaReward(
  rankIndex: number,
  doubled: boolean,
  multiplier = 1,
): number {
  const table = doubled ? MINIGAME_BONUS_REWARDS : MINIGAME_REWARDS;
  if (rankIndex < 0) return 0;
  return (table[rankIndex] ?? 0) * multiplier;
}

/**
 * チーム戦の報酬。勝ったチームの全員に配る。
 * higherIsBetter で勝ち判定の向きが変わる。引き分けは両チームに少し。
 */
export function teamRewards(
  teams: Record<string, number>,
  scores: Record<string, number> | undefined,
  higherIsBetter: boolean,
  mode: MinigameMode,
  multiplier = 1,
): Record<string, number> {
  const totals = teamTotals(teams, scores);
  const entries = Object.entries(totals).map(([team, total]) => ({
    team: Number(team),
    total,
  }));
  const rewards: Record<string, number> = {};
  if (entries.length === 0) return rewards;

  const sorted = [...entries].sort((a, b) =>
    higherIsBetter ? b.total - a.total : a.total - b.total,
  );
  const best = sorted[0];
  if (!best) return rewards;
  const draw = sorted.length > 1 && sorted[1]?.total === best.total;

  for (const [uid, team] of Object.entries(teams)) {
    if (draw) {
      rewards[uid] = TEAM_DRAW_COINS * multiplier;
      continue;
    }
    const won = team === best.team;
    if (mode === "oneVsThree") {
      // 1人側（チーム0）が勝つと大きい。3人側は1人あたり少なめ
      const soloSide = team === 0;
      rewards[uid] = won
        ? (soloSide ? SOLO_WIN_COINS : TRIO_WIN_COINS) * multiplier
        : 0;
    } else {
      rewards[uid] = won ? TEAM_WIN_COINS * multiplier : 0;
    }
  }
  return rewards;
}
