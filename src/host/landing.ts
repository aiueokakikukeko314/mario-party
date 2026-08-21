import { nodeAt } from "../logic/board";
import { luckyOutcome, plainCoinDelta, unluckyOutcome } from "../logic/events";
import { addItem, randomItemId, removeSlot, inventoryList } from "../logic/items";
import { canBuyStar } from "../logic/star";
import { rollStock } from "../logic/shop";
import { findBoardEvent } from "../board/events/registry";
import { applyRoomUpdate } from "../lib/dbGame";
import {
  FINAL_RUSH_COIN_MULTIPLIER,
  TIMEOUT_SHOP_MS,
  TIMEOUT_STAR_MS,
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

/** 止まったマスの効果を適用する。 */
export async function applyLanding(ctx: HostCtx): Promise<void> {
  const board = ctx.room.board;
  if (!board) return;
  const uid = board.currentUid;
  const player = playerOf(ctx, uid);
  if (!player) return;

  // スターマスに止まった場合は購入確認を優先する
  if (player.pos === board.starNodeId) {
    const decision = makeDecision(
      uid,
      "starPurchase",
      { affordable: canBuyStar(player.coins), coins: player.coins },
      TIMEOUT_STAR_MS,
      ctx.now,
    );
    await applyRoomUpdate(ctx.roomCode, actionPaths("landingEvent", decision));
    return;
  }

  const node = nodeAt(ctx.board, player.pos);
  if (!node) {
    await applyRoomUpdate(ctx.roomCode, actionPaths("playerEnd", null));
    return;
  }

  if (node.facility === "shop") {
    const seed = rand();
    const decision = makeDecision(
      uid,
      "shop",
      { stock: rollStock(seed), seed, entered: false },
      TIMEOUT_SHOP_MS,
      ctx.now,
    );
    await applyRoomUpdate(ctx.roomCode, actionPaths("landingEvent", decision));
    return;
  }

  const multiplier = board.finalRush === true ? FINAL_RUSH_COIN_MULTIPLIER : 1;
  const paths: Record<string, unknown> = {};

  switch (node.type) {
    case "plus":
    case "minus": {
      const delta = plainCoinDelta(node.type, multiplier);
      const coin = coinDelta(player, uid, delta);
      Object.assign(paths, coin.paths);
      Object.assign(
        paths,
        eventLog(uid, node.type, `コイン ${delta > 0 ? "+" : ""}${delta}`, {
          coinDelta: coin.applied,
        }),
      );
      break;
    }
    case "lucky": {
      const outcome = luckyOutcome(rand());
      Object.assign(paths, applyOutcomePaths(ctx, uid, outcome, multiplier));
      Object.assign(paths, statDelta(player, uid, { luckyLanded: 1 }));
      Object.assign(paths, eventLog(uid, "lucky", outcome.text));
      break;
    }
    case "unlucky": {
      const outcome = unluckyOutcome(rand());
      Object.assign(paths, applyOutcomePaths(ctx, uid, outcome, multiplier));
      Object.assign(paths, statDelta(player, uid, { unluckyLanded: 1 }));
      Object.assign(paths, eventLog(uid, "unlucky", outcome.text));
      break;
    }
    case "item": {
      const itemId = randomItemId(rand());
      const result = addItem(player.inventory, itemId);
      if (result.ok) paths[playerPath(uid, "inventory")] = result.inventory;
      Object.assign(
        paths,
        eventLog(uid, "item", result.ok ? "アイテムを 手に入れた！" : "持ちきれない…"),
      );
      break;
    }
    case "warp": {
      const target =
        node.warpTo ??
        ctx.board.nodes[Math.floor(rand() * ctx.board.nodes.length)]?.id ??
        player.pos;
      paths[playerPath(uid, "pos")] = target;
      Object.assign(paths, eventLog(uid, "warp", "ワープした！"));
      break;
    }
    case "event": {
      const event = findBoardEvent(node.eventId);
      const effect = event?.run(rand(), board.boardFlags ?? {});
      if (effect) {
        if (effect.flags) {
          for (const [key, value] of Object.entries(effect.flags)) {
            paths[boardPath(`boardFlags/${key}`)] = value;
          }
        }
        if (effect.shuffleCoins) {
          Object.assign(paths, shuffleCoinPaths(ctx));
        }
        Object.assign(paths, eventLog(uid, "event", effect.text));
      }
      Object.assign(paths, statDelta(player, uid, { eventLanded: 1 }));
      break;
    }
    default:
      Object.assign(paths, eventLog(uid, "empty", "なにも おきなかった"));
      break;
  }

  Object.assign(paths, actionPaths("playerEnd", null));
  await applyRoomUpdate(ctx.roomCode, paths);
}

/** lucky / unlucky の内容をパスへ変換する。 */
function applyOutcomePaths(
  ctx: HostCtx,
  uid: string,
  outcome: ReturnType<typeof luckyOutcome>,
  multiplier: number,
): Record<string, unknown> {
  const player = playerOf(ctx, uid);
  if (!player) return {};
  const paths: Record<string, unknown> = {};

  if (outcome.coinDelta !== 0) {
    const coin = coinDelta(player, uid, outcome.coinDelta * multiplier);
    Object.assign(paths, coin.paths);
  }
  if (outcome.giveItem) {
    const result = addItem(player.inventory, randomItemId(rand()));
    if (result.ok) paths[playerPath(uid, "inventory")] = result.inventory;
  }
  if (outcome.loseItem) {
    const items = inventoryList(player.inventory);
    const victim = items[Math.floor(rand() * items.length)];
    if (victim) {
      paths[playerPath(uid, "inventory")] = removeSlot(player.inventory, victim.slot);
    }
  }
  if (outcome.nextDiceBonus) {
    paths[boardPath("boardFlags/nextDiceBonus")] = outcome.nextDiceBonus;
  }
  if (outcome.transferToOthers) {
    const amount = outcome.transferToOthers;
    let given = 0;
    for (const entry of ctx.ordered) {
      if (entry.uid === uid) continue;
      const take = Math.min(amount, Math.max(0, player.coins - given));
      if (take <= 0) break;
      const gain = coinDelta(entry.player, entry.uid, take);
      Object.assign(paths, gain.paths);
      given += take;
    }
    if (given > 0) {
      const loss = coinDelta(player, uid, -given);
      Object.assign(paths, loss.paths);
    }
  }
  return paths;
}

/** 全員のコインを入れ替える。 */
function shuffleCoinPaths(ctx: HostCtx): Record<string, unknown> {
  const uids = ctx.ordered.map((entry) => entry.uid);
  const coins = ctx.ordered.map((entry) => entry.player.coins);
  for (let i = coins.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = coins[i];
    const b = coins[j];
    if (a !== undefined && b !== undefined) {
      coins[i] = b;
      coins[j] = a;
    }
  }
  const paths: Record<string, unknown> = {};
  uids.forEach((uid, index) => {
    paths[playerPath(uid, "coins")] = coins[index] ?? 0;
  });
  return paths;
}
