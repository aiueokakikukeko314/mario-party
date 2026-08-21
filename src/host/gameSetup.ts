import { EMPTY_STATS } from "../logic/bonus";
import { pickNextStarNode } from "../logic/star";
import { applyRoomUpdate } from "../lib/dbGame";
import { FINAL_RUSH_ENABLED, FINAL_RUSH_TURNS } from "../constants";
import { playerPath, rand, type HostCtx } from "./shared";
import type { BoardState } from "../types";

/**
 * ゲーム開始時の初期化（ホストのみ）。
 * 手番順の抽選・初期コイン・スター位置をここで決めて1回で書き込む。
 */
export async function setupGame(ctx: HostCtx): Promise<void> {
  const uids = ctx.ordered.map((entry) => entry.uid);
  if (uids.length === 0) return;

  // 手番順をシャッフル（乱数はホストだけが作る）
  const shuffled = [...uids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }

  const paths: Record<string, unknown> = {};
  shuffled.forEach((uid, index) => {
    paths[playerPath(uid, "order")] = index;
    paths[playerPath(uid, "coins")] = ctx.config.startingCoins;
    paths[playerPath(uid, "stars")] = 0;
    paths[playerPath(uid, "pos")] = ctx.board.startNodeId;
    paths[playerPath(uid, "stats")] = { ...EMPTY_STATS };
    paths[playerPath(uid, "inventory")] = null;
    paths[playerPath(uid, "shielded")] = null;
  });

  const first = shuffled[0];
  if (first === undefined) return;

  const starNodeId = pickNextStarNode(ctx.board, -1, null, rand());
  const board: BoardState = {
    turn: 1,
    currentUid: first,
    currentOrderIndex: 0,
    action: "turnStart",
    diceTotal: null,
    movesRemaining: 0,
    starNodeId,
    previousStarNodeId: null,
    finalRush: isFinalRush(1, ctx.config.maxTurns),
  };

  paths["board"] = board;
  paths["minigame"] = null;
  paths["bonus"] = null;
  paths["inputs"] = null;
  paths["meta/phase"] = "board";
  await applyRoomUpdate(ctx.roomCode, paths);
}

/** 残りわずかのターンかどうか。 */
export function isFinalRush(turn: number, maxTurns: number): boolean {
  if (!FINAL_RUSH_ENABLED) return false;
  return maxTurns - turn + 1 <= FINAL_RUSH_TURNS;
}
