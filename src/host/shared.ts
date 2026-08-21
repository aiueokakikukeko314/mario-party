import { findBoard } from "../board/registry";
import { statsOf } from "../logic/bonus";
import { sortPlayers } from "../logic/lobby";
import { serverNow } from "../lib/time";
import type { BoardDef } from "../board/types";
import type {
  BoardAction,
  DecisionType,
  GameConfig,
  PendingDecision,
  Player,
  PlayerStats,
  Room,
} from "../types";

/** ホストの処理で共通に使う道具。 */

export interface HostCtx {
  roomCode: string;
  room: Room;
  board: BoardDef;
  config: GameConfig;
  /** 手番順のプレイヤー */
  ordered: { uid: string; player: Player }[];
  now: number;
}

export function makeCtx(roomCode: string, room: Room): HostCtx {
  const config = room.config ?? {
    boardId: "party-island",
    maxTurns: 10,
    bonusAwardsEnabled: true,
    itemsEnabled: true,
    startingCoins: 10,
  };
  return {
    roomCode,
    room,
    board: findBoard(config.boardId),
    config,
    ordered: sortPlayers(room.players ?? {}),
    now: serverNow(),
  };
}

export const playerOf = (ctx: HostCtx, uid: string): Player | undefined =>
  ctx.room.players?.[uid];

/** 乱数はホストだけが作る（CLAUDE.md セクション3）。 */
export const rand = (): number => Math.random();
export const randInt = (maxExclusive: number): number =>
  Math.floor(Math.random() * maxExclusive);

/** 選択待ちを1つ作る。 */
export function makeDecision(
  uid: string,
  type: DecisionType,
  options: unknown,
  timeoutMs: number,
  now: number,
): PendingDecision {
  return {
    id: `${type}-${uid}-${now}-${randInt(100000)}`,
    uid,
    type,
    options,
    createdAt: now,
    timeoutAt: now + timeoutMs,
  };
}

/** board 配下の書き込みパスを作る。 */
export const boardPath = (key: string): string => `board/${key}`;
export const playerPath = (uid: string, key: string): string =>
  `players/${uid}/${key}`;

/** 統計を加算するためのパス群を作る。 */
export function statDelta(
  player: Player | undefined,
  uid: string,
  delta: Partial<PlayerStats>,
): Record<string, unknown> {
  const current = statsOf(player);
  const paths: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(delta)) {
    if (typeof value !== "number" || value === 0) continue;
    const typedKey = key as keyof PlayerStats;
    paths[playerPath(uid, `stats/${key}`)] = current[typedKey] + value;
  }
  return paths;
}

/**
 * コインを増減するパスを作る。0未満にはしない。
 * 減少で shield を持っていれば1回だけ無効化する。
 */
export function coinDelta(
  player: Player | undefined,
  uid: string,
  delta: number,
): { paths: Record<string, unknown>; applied: number } {
  if (!player || delta === 0) return { paths: {}, applied: 0 };

  if (delta < 0 && player.shielded === true) {
    return {
      paths: {
        [playerPath(uid, "shielded")]: null,
      },
      applied: 0,
    };
  }
  const next = Math.max(0, player.coins + delta);
  const applied = next - player.coins;
  const paths: Record<string, unknown> = { [playerPath(uid, "coins")]: next };
  const stats = statDelta(
    player,
    uid,
    applied >= 0 ? { coinsEarned: applied } : { coinsLost: -applied },
  );
  return { paths: { ...paths, ...stats }, applied };
}

/** 進行状態を変えるパス。pendingDecision を消したいときは null を渡す。 */
export function actionPaths(
  action: BoardAction,
  pending?: PendingDecision | null,
): Record<string, unknown> {
  const paths: Record<string, unknown> = { [boardPath("action")]: action };
  if (pending !== undefined) {
    paths[boardPath("pendingDecision")] = pending;
  }
  return paths;
}

/** 表示用のログ。 */
export function eventLog(
  uid: string,
  kind: string,
  text: string,
  extra?: { coinDelta?: number; starDelta?: number },
): Record<string, unknown> {
  const log: Record<string, unknown> = {
    kind,
    uid,
    text,
    at: serverNow(),
  };
  if (extra?.coinDelta !== undefined) log["coinDelta"] = extra.coinDelta;
  if (extra?.starDelta !== undefined) log["starDelta"] = extra.starDelta;
  return { [boardPath("lastEvent")]: log };
}

/** 入力を処理済みとして記録するパス。 */
export function markProcessed(uid: string, seq: number): Record<string, unknown> {
  return { [boardPath(`lastProcessedInputSeq/${uid}`)]: seq };
}

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
