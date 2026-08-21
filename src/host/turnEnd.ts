import { applyRoomUpdate, setPhase } from "../lib/dbGame";
import { isFinalRush } from "./gameSetup";
import { actionPaths, boardPath, type HostCtx } from "./shared";

/** 手番の終わりと、次の人・次のターンへの進行。 */

/** 次のプレイヤーへ。全員終わったらミニゲームへ。 */
export async function endPlayerTurn(ctx: HostCtx): Promise<void> {
  const board = ctx.room.board;
  if (!board) return;

  const nextIndex = board.currentOrderIndex + 1;
  const next = ctx.ordered[nextIndex];

  if (next) {
    await applyRoomUpdate(ctx.roomCode, {
      [boardPath("currentUid")]: next.uid,
      [boardPath("currentOrderIndex")]: nextIndex,
      [boardPath("diceValues")]: null,
      [boardPath("diceTotal")]: null,
      [boardPath("movesRemaining")]: 0,
      ...actionPaths("turnStart", null),
    });
    return;
  }

  // 全員が振り終わったのでミニゲームへ
  await applyRoomUpdate(ctx.roomCode, {
    ...actionPaths("waiting", null),
    "meta/phase": "minigameIntro",
  });
}

/** ミニゲームが終わったあと、次のターンを始めるか結果へ進む。 */
export async function startNextTurn(ctx: HostCtx): Promise<void> {
  const board = ctx.room.board;
  if (!board) return;

  if (board.turn >= ctx.config.maxTurns) {
    await applyRoomUpdate(ctx.roomCode, {
      minigame: null,
      "meta/phase": ctx.config.bonusAwardsEnabled ? "finalBonus" : "gameEnd",
    });
    return;
  }

  const first = ctx.ordered[0];
  if (!first) {
    await setPhase(ctx.roomCode, "gameEnd");
    return;
  }
  const turn = board.turn + 1;
  await applyRoomUpdate(ctx.roomCode, {
    minigame: null,
    [boardPath("turn")]: turn,
    [boardPath("currentUid")]: first.uid,
    [boardPath("currentOrderIndex")]: 0,
    [boardPath("diceValues")]: null,
    [boardPath("diceTotal")]: null,
    [boardPath("movesRemaining")]: 0,
    [boardPath("finalRush")]: isFinalRush(turn, ctx.config.maxTurns),
    ...actionPaths("turnStart", null),
    "meta/phase": "board",
  });
}
