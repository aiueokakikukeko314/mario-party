import { isBranch, nextOf, stepFrom } from "../logic/board";
import { canBuyStar } from "../logic/star";
import { rollStock } from "../logic/shop";
import { applyRoomUpdate } from "../lib/dbGame";
import { TIMEOUT_BRANCH_MS, TIMEOUT_SHOP_MS, TIMEOUT_STAR_MS } from "../constants";
import { STEP_MS } from "../lib/hostTiming";
import {
  actionPaths,
  boardPath,
  makeDecision,
  playerOf,
  playerPath,
  rand,
  statDelta,
  wait,
  type HostCtx,
} from "./shared";
import { nodeAt } from "../logic/board";

/**
 * 1マスずつ進める。サイコロの結果を一気に適用しない。
 * 分岐・通過イベントに当たったらそこで止めて選択待ちにする。
 */
export async function advanceOneStep(ctx: HostCtx): Promise<void> {
  const board = ctx.room.board;
  if (!board) return;
  const uid = board.currentUid;
  const player = playerOf(ctx, uid);
  if (!player) return;

  // 進む先が2つ以上なら本人に選んでもらう
  if (isBranch(ctx.board, player.pos)) {
    const decision = makeDecision(
      uid,
      "branch",
      { from: player.pos, options: nextOf(ctx.board, player.pos) },
      TIMEOUT_BRANCH_MS,
      ctx.now,
    );
    await applyRoomUpdate(ctx.roomCode, actionPaths("branchChoice", decision));
    return;
  }

  await moveTo(ctx, uid, stepFrom(ctx.board, player.pos));
}

/**
 * 実際に1マス動かし、その先で止まるべきか判断する。
 * 途中（movesRemaining > 0）でスターやショップを通ったら止める。
 */
export async function moveTo(
  ctx: HostCtx,
  uid: string,
  to: number,
): Promise<void> {
  const board = ctx.room.board;
  const player = playerOf(ctx, uid);
  if (!board || !player) return;

  const remaining = Math.max(0, board.movesRemaining - 1);
  await applyRoomUpdate(ctx.roomCode, {
    [playerPath(uid, "pos")]: to,
    [boardPath("movesRemaining")]: remaining,
    ...statDelta(player, uid, { spacesMoved: 1 }),
    ...actionPaths(remaining > 0 ? "moving" : "landingEvent", null),
  });

  // コマが動く見た目に合わせて少し待つ
  await wait(STEP_MS);

  if (remaining <= 0) return;

  // 通過イベント（スター / ショップ）
  const nextCtx: HostCtx = {
    ...ctx,
    room: {
      ...ctx.room,
      players: { ...(ctx.room.players ?? {}), [uid]: { ...player, pos: to } },
      board: { ...board, movesRemaining: remaining },
    },
  };
  await maybePassingEvent(nextCtx, uid, to);
}

/** 通過中のスター・ショップで止める。止めなければ何もしない。 */
async function maybePassingEvent(
  ctx: HostCtx,
  uid: string,
  pos: number,
): Promise<void> {
  const board = ctx.room.board;
  const player = playerOf(ctx, uid);
  if (!board || !player) return;

  if (pos === board.starNodeId) {
    const decision = makeDecision(
      uid,
      "starPurchase",
      { affordable: canBuyStar(player.coins), coins: player.coins },
      TIMEOUT_STAR_MS,
      ctx.now,
    );
    await applyRoomUpdate(ctx.roomCode, actionPaths("passingEvent", decision));
    return;
  }

  const node = nodeAt(ctx.board, pos);
  if (node?.facility === "shop") {
    const seed = rand();
    const decision = makeDecision(
      uid,
      "shop",
      { stock: rollStock(seed), seed, entered: false },
      TIMEOUT_SHOP_MS,
      ctx.now,
    );
    await applyRoomUpdate(ctx.roomCode, actionPaths("passingEvent", decision));
  }
}

/** 通過イベントが終わったので移動を再開する。 */
export async function resumeMoving(ctx: HostCtx): Promise<void> {
  const board = ctx.room.board;
  if (!board) return;
  const action = board.movesRemaining > 0 ? "moving" : "landingEvent";
  await applyRoomUpdate(ctx.roomCode, actionPaths(action, null));
}
