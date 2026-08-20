import { hasMinigameBonus } from "../logic/board";
import { computeRanking } from "../logic/ranking";
import { computeRewards } from "../logic/reward";
import { findMinigame } from "../minigames/registry";
import {
  clearInput,
  setPhase,
  writePlayerStats,
  writeRanking,
  writeScore,
} from "./dbGame";
import { SCORE_GRACE_MS } from "./hostTiming";
import { serverNow } from "./time";
import type { Player, Room } from "../types";

/**
 * 届いたスコアを集計し、全員そろうか締め切りを過ぎたら順位と報酬を確定する。
 *
 * プレイヤーは minigame ノードに直接書けない（CLAUDE.md セクション9）ので、
 * 各自 inputs/{uid} に score を書き、ホストがここで minigame/scores へ移す。
 */
export async function collectScores(
  roomCode: string,
  room: Room,
  ordered: { uid: string; player: Player }[],
): Promise<void> {
  const minigame = room.minigame;
  const game = findMinigame(minigame?.id);
  if (!minigame || !game) return;

  // 届いている入力を集計場所へ移す
  let moved = false;
  for (const { uid } of ordered) {
    const input = room.inputs?.[uid];
    if (input?.type !== "score") continue;
    const value = typeof input.value === "number" ? input.value : 0;
    await writeScore(roomCode, uid, value);
    await clearInput(roomCode, uid);
    moved = true;
  }
  // 書き込みの結果がまた流れてくるので、締め切り判定はその時に行う
  if (moved) return;

  const scores = minigame.scores;
  const allScored = ordered.every(
    (entry) => typeof scores?.[entry.uid] === "number",
  );
  const deadlinePassed =
    serverNow() > (minigame.endAt ?? 0) + SCORE_GRACE_MS;
  if (!allScored && !deadlinePassed) return;

  const ranking = computeRanking(
    ordered.map((entry) => entry.uid),
    scores,
    game.higherIsBetter,
  );
  // minigame マスに止まっていた人は報酬2倍（CLAUDE.md セクション8）
  const doubled = new Set(
    ordered
      .filter((entry) => hasMinigameBonus(entry.player.pos))
      .map((entry) => entry.uid),
  );
  const rewards = computeRewards(ranking, doubled);

  for (const { uid, player } of ordered) {
    const gain = rewards[uid] ?? 0;
    if (gain === 0) continue;
    await writePlayerStats(roomCode, uid, {
      coins: player.coins + gain,
      stars: player.stars,
      pos: player.pos,
    });
  }

  await writeRanking(roomCode, ranking);
  await setPhase(roomCode, "minigameResult");
}
