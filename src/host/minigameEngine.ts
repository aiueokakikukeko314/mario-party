import { findMinigame, modeOf, pickMinigame } from "../minigames/registry";
import { assignTeams, ffaReward, teamRewards } from "../logic/minigame";
import { computeRanking } from "../logic/ranking";
import { isPlausibleScore } from "../logic/input";
import { nodeAt } from "../logic/board";
import { applyRoomUpdate } from "../lib/dbGame";
import {
  FINAL_RUSH_REWARD_MULTIPLIER,
  RECENT_MINIGAME_MEMORY,
} from "../constants";
import { INTRO_MS, RESULT_MS, SCORE_GRACE_MS } from "../lib/hostTiming";
import { coinDelta, playerPath, rand, statDelta, type HostCtx } from "./shared";
import { startNextTurn } from "./turnEnd";
import type { MinigameState } from "../types";

/** ミニゲームの選出・集計（ホストのみ）。 */

/** ミニゲームを1本選び、全員同時に始まる絶対時刻を書き込む。 */
export async function selectMinigame(ctx: HostCtx): Promise<void> {
  const board = ctx.room.board;
  const count = ctx.ordered.length;
  const recent = board?.recentMinigameIds ?? [];
  const game = pickMinigame(rand(), recent, count);
  if (!game) return;

  const mode = modeOf(game);
  const startAt = ctx.now + INTRO_MS;
  const state: MinigameState = {
    id: game.id,
    mode,
    seed: Math.floor(rand() * 1000000),
    startAt,
    endAt: startAt + game.durationMs,
    ranking: null,
  };
  const teams = assignTeams(
    ctx.ordered.map((entry) => entry.uid),
    mode,
    Math.floor(rand() * Math.max(1, count)),
  );
  if (Object.keys(teams).length > 0) state.teams = teams;

  await applyRoomUpdate(ctx.roomCode, {
    minigame: state,
    "board/recentMinigameIds": [game.id, ...recent].slice(
      0,
      RECENT_MINIGAME_MEMORY,
    ),
  });
}

/** startAt を過ぎたらプレイ中のフェーズへ進める。 */
export async function beginMinigame(ctx: HostCtx): Promise<void> {
  await applyRoomUpdate(ctx.roomCode, { "meta/phase": "minigame" });
}

/** 届いたスコアを受け取る。検証してから書く。 */
export function scorePaths(
  ctx: HostCtx,
  uid: string,
  payload: unknown,
): Record<string, unknown> | null {
  const minigame = ctx.room.minigame;
  if (!minigame?.id) return null;
  if (minigame.submitted?.[uid] === true) return null;

  const raw =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)["score"]
      : payload;
  if (!isPlausibleScore(raw)) return null;

  return {
    [`minigame/scores/${uid}`]: raw,
    [`minigame/submitted/${uid}`]: true,
  };
}

/** 全員そろったか、締め切りを過ぎたら順位と報酬を確定する。 */
export async function finishMinigame(ctx: HostCtx): Promise<boolean> {
  const minigame = ctx.room.minigame;
  const game = findMinigame(minigame?.id);
  if (!minigame || !game) return false;

  // 離脱した人は待たない。未提出のまま最下位として扱う
  const allDone = ctx.ordered.every(
    (entry) =>
      minigame.submitted?.[entry.uid] === true || !entry.player.connected,
  );
  const overdue = ctx.now > (minigame.endAt ?? 0) + SCORE_GRACE_MS;
  if (!allDone && !overdue) return false;

  const uids = ctx.ordered.map((entry) => entry.uid);
  const ranking = computeRanking(uids, minigame.scores, game.higherIsBetter);
  const multiplier =
    ctx.room.board?.finalRush === true ? FINAL_RUSH_REWARD_MULTIPLIER : 1;

  const mode = minigame.mode ?? "ffa";
  const rewards: Record<string, number> =
    mode === "ffa" || !minigame.teams
      ? Object.fromEntries(
          ranking.map((uid, index) => [
            uid,
            ffaReward(index, isBonusTile(ctx, uid), multiplier),
          ]),
        )
      : teamRewards(
          minigame.teams,
          minigame.scores,
          game.higherIsBetter,
          mode,
          multiplier,
        );

  const paths: Record<string, unknown> = { "minigame/ranking": ranking };
  const winner = ranking[0];
  for (const entry of ctx.ordered) {
    const gain = rewards[entry.uid] ?? 0;
    if (gain > 0) {
      const coin = coinDelta(entry.player, entry.uid, gain);
      Object.assign(paths, coin.paths);
      Object.assign(
        paths,
        statDelta(entry.player, entry.uid, { minigameCoins: gain }),
      );
    }
    if (entry.uid === winner) {
      Object.assign(
        paths,
        statDelta(entry.player, entry.uid, { minigameWins: 1 }),
      );
    }
    paths[`minigame/submitted/${entry.uid}`] = true;
  }
  paths["meta/phase"] = "minigameResult";
  await applyRoomUpdate(ctx.roomCode, paths);
  return true;
}

/** ミニゲームのマスに止まっていたか（報酬2倍）。 */
function isBonusTile(ctx: HostCtx, uid: string): boolean {
  const pos = ctx.room.players?.[uid]?.pos;
  if (pos === undefined) return false;
  return nodeAt(ctx.board, pos)?.facility === "gate";
}

/** 結果表示が終わったら次のターンへ。 */
export async function afterResult(ctx: HostCtx): Promise<void> {
  const endAt = ctx.room.minigame?.endAt ?? 0;
  if (ctx.now < endAt + RESULT_MS) return;
  await startNextTurn(ctx);
}

export { playerPath };
