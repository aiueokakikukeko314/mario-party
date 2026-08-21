import { AWARD_STARS, decideAwards, pickAwards } from "../logic/bonus";
import { applyRoomUpdate } from "../lib/dbGame";
import { RESULT_MS } from "../lib/hostTiming";
import { playerPath, rand, type HostCtx } from "./shared";

/** 最終ボーナス賞（ホストのみ）。 */

/** まだ決めていなければ賞と受賞者を決める。 */
export async function prepareBonus(ctx: HostCtx): Promise<void> {
  if (ctx.room.bonus) return;
  const awards = pickAwards([rand(), rand(), rand(), rand()]);
  const decided = decideAwards(awards, ctx.room.players ?? {});
  await applyRoomUpdate(ctx.roomCode, {
    bonus: { awards: decided, revealed: 0, at: ctx.now },
  });
}

/** 1つずつ発表し、スターを加算する。全部出したら最終結果へ。 */
export async function revealNextAward(ctx: HostCtx): Promise<void> {
  const bonus = ctx.room.bonus;
  if (!bonus) return;

  if (bonus.revealed >= bonus.awards.length) {
    await applyRoomUpdate(ctx.roomCode, { "meta/phase": "gameEnd" });
    return;
  }

  const award = bonus.awards[bonus.revealed];
  const paths: Record<string, unknown> = {
    "bonus/revealed": bonus.revealed + 1,
  };
  if (award) {
    for (const uid of award.winners) {
      const player = ctx.room.players?.[uid];
      if (!player) continue;
      paths[playerPath(uid, "stars")] = player.stars + AWARD_STARS;
    }
  }
  await applyRoomUpdate(ctx.roomCode, paths);
}

/** 発表の間隔。 */
export const AWARD_INTERVAL_MS = RESULT_MS;
