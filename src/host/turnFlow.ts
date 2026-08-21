import { diceEffectOf, inventoryList, removeSlot, type SlotKey } from "../logic/items";
import { findItem } from "../board/items/registry";
import { applyRoomUpdate } from "../lib/dbGame";
import {
  DICE_MAX,
  DICE_MIN,
  TIMEOUT_DICE_MS,
  TIMEOUT_ITEM_MS,
} from "../constants";
import {
  actionPaths,
  boardPath,
  coinDelta,
  eventLog,
  makeDecision,
  playerOf,
  playerPath,
  rand,
  statDelta,
  type HostCtx,
} from "./shared";

/** ターン開始 → アイテム選択 → サイコロ、までの進行。 */

/** 手番の最初。アイテムを持っていれば使うか聞く。 */
export async function beginTurn(ctx: HostCtx): Promise<void> {
  const board = ctx.room.board;
  if (!board) return;
  const uid = board.currentUid;
  const player = playerOf(ctx, uid);
  const items = inventoryList(player?.inventory);

  if (ctx.config.itemsEnabled && items.length > 0 && player?.connected) {
    const decision = makeDecision(
      uid,
      "itemChoice",
      { slots: items.map((entry) => entry.slot) },
      TIMEOUT_ITEM_MS,
      ctx.now,
    );
    await applyRoomUpdate(ctx.roomCode, {
      ...actionPaths("itemChoice", decision),
      [boardPath("diceValues")]: null,
      [boardPath("diceTotal")]: null,
    });
    return;
  }
  await toDiceRoll(ctx);
}

/** サイコロ待ちにする。 */
export async function toDiceRoll(ctx: HostCtx): Promise<void> {
  const board = ctx.room.board;
  if (!board) return;
  const decision = makeDecision(
    board.currentUid,
    "eventChoice",
    { kind: "dice" },
    TIMEOUT_DICE_MS,
    ctx.now,
  );
  await applyRoomUpdate(ctx.roomCode, {
    ...actionPaths("diceRoll", decision),
    [boardPath("diceValues")]: null,
    [boardPath("diceTotal")]: null,
  });
}

/**
 * アイテムを使う（自分に効くものだけここで完結）。
 * 相手を選ぶタイプは itemTarget の選択待ちへ進む。
 */
export async function useSelfItem(
  ctx: HostCtx,
  uid: string,
  slot: SlotKey,
): Promise<void> {
  const player = playerOf(ctx, uid);
  const item = findItem(player?.inventory?.[slot]);
  if (!player || !item) {
    await toDiceRoll(ctx);
    return;
  }

  const paths: Record<string, unknown> = {
    [playerPath(uid, "inventory")]: removeSlot(player.inventory, slot),
    ...statDelta(player, uid, { itemsUsed: 1 }),
    ...eventLog(uid, "item", `${item.name} を つかった！`),
  };

  if (item.id === "shield") {
    paths[playerPath(uid, "shielded")] = true;
  } else if (item.diceCount !== undefined || item.diceBonus !== undefined) {
    // 出目に効くアイテムは、振るときに参照できるよう覚えておく
    paths[boardPath("boardFlags/pendingItemId")] = item.id;
  }

  await applyRoomUpdate(ctx.roomCode, paths);
  await toDiceRoll({ ...ctx, room: ctx.room });
}

/** サイコロを振る。出目はホストだけが決める。 */
export async function rollDice(ctx: HostCtx, uid: string): Promise<void> {
  const board = ctx.room.board;
  if (!board) return;

  const pendingItemId = board.boardFlags?.["pendingItemId"];
  const effect = diceEffectOf(
    typeof pendingItemId === "string" ? pendingItemId : null,
  );

  const values: number[] = [];
  for (let i = 0; i < effect.count; i++) {
    values.push(DICE_MIN + Math.floor(rand() * (DICE_MAX - DICE_MIN + 1)));
  }
  const bonusFlag = board.boardFlags?.["nextDiceBonus"];
  const extraBonus = typeof bonusFlag === "number" ? bonusFlag : 0;
  const total = values.reduce((sum, v) => sum + v, 0) + effect.bonus + extraBonus;

  await applyRoomUpdate(ctx.roomCode, {
    ...actionPaths("moving", null),
    [boardPath("diceValues")]: values,
    [boardPath("diceTotal")]: total,
    [boardPath("movesRemaining")]: total,
    [boardPath("boardFlags/pendingItemId")]: null,
    [boardPath("boardFlags/nextDiceBonus")]: null,
    ...eventLog(uid, "dice", `${total} すすむ！`),
  });
}

/** コインを直接動かしたいとき用（アイテム効果など）。 */
export async function transferCoins(
  ctx: HostCtx,
  fromUid: string,
  toUid: string,
  amount: number,
): Promise<void> {
  const from = playerOf(ctx, fromUid);
  const to = playerOf(ctx, toUid);
  if (!from || !to || amount <= 0) return;
  const taken = Math.min(amount, from.coins);
  const a = coinDelta(from, fromUid, -taken);
  const b = coinDelta(to, toUid, taken);
  await applyRoomUpdate(ctx.roomCode, { ...a.paths, ...b.paths });
}
