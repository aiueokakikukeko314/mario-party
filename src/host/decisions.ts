import { isLegalStep, stepFrom } from "../logic/board";
import { addItem } from "../logic/items";
import { buyBlockReason } from "../logic/shop";
import { findItem } from "../board/items/registry";
import { applyStarPurchase, canBuyStar, pickNextStarNode } from "../logic/star";
import { applyRoomUpdate } from "../lib/dbGame";
import { STAR_COST } from "../constants";
import {
  actionPaths,
  boardPath,
  coinDelta,
  eventLog,
  playerOf,
  playerPath,
  rand,
  statDelta,
  type HostCtx,
} from "./shared";
import { moveTo, resumeMoving } from "./movement";
import { useSelfItem, toDiceRoll } from "./turnFlow";
import type { SlotKey } from "../logic/items";

/** 選択待ちへの応答を処理する。payload は検証してから使う。 */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/** 分岐の選択。不正なら既定の1本目へ進める。 */
export async function resolveBranch(
  ctx: HostCtx,
  uid: string,
  payload: unknown,
): Promise<void> {
  const player = playerOf(ctx, uid);
  if (!player) return;
  const raw = asRecord(payload)["to"];
  const requested = typeof raw === "number" ? raw : null;
  const to =
    requested !== null && isLegalStep(ctx.board, player.pos, requested)
      ? requested
      : stepFrom(ctx.board, player.pos);

  await applyRoomUpdate(ctx.roomCode, actionPaths("moving", null));
  await moveTo(ctx, uid, to);
}

/** スター購入の返事。 */
export async function resolveStar(
  ctx: HostCtx,
  uid: string,
  payload: unknown,
): Promise<void> {
  const board = ctx.room.board;
  const player = playerOf(ctx, uid);
  if (!board || !player) return;

  const buy = asRecord(payload)["buy"] === true;
  if (!buy || !canBuyStar(player.coins)) {
    const text = buy ? "コインが たりない…" : "スターを 買わなかった";
    await applyRoomUpdate(ctx.roomCode, {
      ...eventLog(uid, "star", text),
      ...actionPaths(board.movesRemaining > 0 ? "moving" : "landingEvent", null),
    });
    if (board.movesRemaining <= 0) return;
    await resumeMoving(ctx);
    return;
  }

  const result = applyStarPurchase(player.coins, player.stars);
  const nextStar = pickNextStarNode(
    ctx.board,
    board.starNodeId,
    board.previousStarNodeId,
    rand(),
  );

  await applyRoomUpdate(ctx.roomCode, {
    [playerPath(uid, "coins")]: result.coins,
    [playerPath(uid, "stars")]: result.stars,
    ...statDelta(player, uid, { starsBought: 1, coinsLost: STAR_COST }),
    [boardPath("starNodeId")]: nextStar,
    [boardPath("previousStarNodeId")]: board.starNodeId,
    ...eventLog(uid, "star", "スターを 手に入れた！", { starDelta: 1 }),
    ...actionPaths(board.movesRemaining > 0 ? "moving" : "landingEvent", null),
  });
}

/** ショップの返事。入る / 買う / 出る。 */
export async function resolveShop(
  ctx: HostCtx,
  uid: string,
  payload: unknown,
): Promise<void> {
  const board = ctx.room.board;
  const player = playerOf(ctx, uid);
  if (!board || !player) return;

  const data = asRecord(payload);
  const buyId = typeof data["itemId"] === "string" ? data["itemId"] : null;

  if (buyId !== null) {
    const item = findItem(buyId);
    const blocked = buyBlockReason(buyId, player.coins, player.inventory);
    if (item && blocked === null) {
      const result = addItem(player.inventory, buyId);
      const coin = coinDelta(player, uid, -item.price);
      await applyRoomUpdate(ctx.roomCode, {
        ...coin.paths,
        [playerPath(uid, "inventory")]: result.inventory,
        ...statDelta(player, uid, { shopSpent: item.price }),
        ...eventLog(uid, "shop", `${item.name} を かった！`),
        ...actionPaths(board.movesRemaining > 0 ? "moving" : "landingEvent", null),
      });
      return;
    }
  }

  await applyRoomUpdate(ctx.roomCode, {
    ...eventLog(uid, "shop", "ショップを 出た"),
    ...actionPaths(board.movesRemaining > 0 ? "moving" : "landingEvent", null),
  });
}

/** アイテム選択の返事。使わない場合はそのままサイコロへ。 */
export async function resolveItemChoice(
  ctx: HostCtx,
  uid: string,
  payload: unknown,
): Promise<void> {
  const data = asRecord(payload);
  const slot = data["slot"];
  const valid: readonly string[] = ["slot0", "slot1", "slot2"];
  if (typeof slot === "string" && valid.includes(slot)) {
    await useSelfItem(ctx, uid, slot as SlotKey);
    return;
  }
  await toDiceRoll(ctx);
}
