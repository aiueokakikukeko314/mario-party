import { useEffect, useRef, useState } from "react";
import { isAcceptable } from "../logic/input";
import { applyRoomUpdate, clearInput } from "../lib/dbGame";
import { TICK_MS } from "../lib/hostTiming";
import { selectIsHost, useRoom } from "../store/useRoom";
import { makeCtx, markProcessed, type HostCtx } from "./shared";
import { setupGame } from "./gameSetup";
import { beginTurn, rollDice } from "./turnFlow";
import { advanceOneStep } from "./movement";
import { applyLanding } from "./landing";
import {
  resolveBranch,
  resolveDiceChoice,
  resolveItemChoice,
  resolveItemTarget,
  resolveShop,
  resolveStar,
} from "./decisions";
import { endPlayerTurn } from "./turnEnd";
import {
  afterResult,
  beginMinigame,
  finishMinigame,
  scorePaths,
  selectMinigame,
} from "./minigameEngine";
import { AWARD_INTERVAL_MS, prepareBonus, revealNextAward } from "./bonusEngine";
import type { PlayerInput, Room } from "../types";

/**
 * ホスト端末だけが回すゲームエンジン（CLAUDE.md セクション3）。
 *
 * hostEpoch を起動時に控え、DB 側の epoch と食い違ったら即停止する。
 * 旧ホストが復帰しても、古いエンジンが処理を続けないようにするため。
 */
export function useHostEngine(): void {
  const room = useRoom((s) => s.room);
  const roomCode = useRoom((s) => s.roomCode);
  const myUid = useRoom((s) => s.myUid);
  const isHost = selectIsHost(room, myUid);

  const busyRef = useRef(false);
  const epochRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  // 時刻で進む場面があるので、DB 更新が無くても定期的に見直す
  useEffect(() => {
    if (!isHost) return;
    const id = setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => clearInterval(id);
  }, [isHost]);

  // ホストでなくなったら、次にホストになったとき epoch を取り直す
  useEffect(() => {
    if (!isHost) epochRef.current = null;
  }, [isHost]);

  useEffect(() => {
    if (!isHost || roomCode === null || room === null || myUid === null) return;
    if (busyRef.current) return;

    // 自分がホストになった時点の epoch を覚える
    if (epochRef.current === null) epochRef.current = room.meta.hostEpoch;
    // 誰かに引き継がれていたら、このエンジンはもう動かない
    if (epochRef.current !== room.meta.hostEpoch) return;

    const ctx = makeCtx(roomCode, room);
    if (ctx.ordered.length === 0) return;

    busyRef.current = true;
    void step(ctx, myUid).finally(() => {
      busyRef.current = false;
    });
  }, [isHost, roomCode, room, myUid, tick]);
}

/** 1回ぶんの進行。状態を見て、やるべきことを1つだけ実行する。 */
async function step(ctx: HostCtx, hostUid: string): Promise<void> {
  const phase = ctx.room.meta.phase;

  if (phase === "gameSetup") {
    await setupGame(ctx);
    return;
  }
  if (phase === "minigameIntro") {
    if (!ctx.room.minigame?.id) {
      await selectMinigame(ctx);
    } else if (ctx.now >= (ctx.room.minigame.startAt ?? Infinity)) {
      await beginMinigame(ctx);
    }
    return;
  }
  if (phase === "minigame") {
    if (await consumeInputs(ctx)) return;
    await finishMinigame(ctx);
    return;
  }
  if (phase === "minigameResult") {
    await afterResult(ctx);
    return;
  }
  if (phase === "finalBonus") {
    if (!ctx.room.bonus) {
      await prepareBonus(ctx);
      return;
    }
    const at = ctx.room.board?.lastEvent?.at ?? 0;
    if (ctx.now - Math.max(at, 0) < AWARD_INTERVAL_MS && ctx.room.bonus.revealed > 0) {
      // 少し間を置いてから次を出す
    }
    await revealNextAward(ctx);
    return;
  }
  if (phase !== "board" || !ctx.room.board) return;

  // 先に入力を処理する（選択待ちの返事など）
  if (await consumeInputs(ctx)) return;

  const board = ctx.room.board;
  const pending = board.pendingDecision;

  // 返事が来ないまま止まらないよう、時間切れは既定の動作で進める
  if (pending && ctx.now > pending.timeoutAt) {
    await resolveDecision(ctx, pending.uid, pending.type, defaultPayload(pending.type));
    return;
  }
  if (pending) {
    // 切断中の人は待たずに既定動作へ
    const target = ctx.room.players?.[pending.uid];
    if (target && !target.connected) {
      await resolveDecision(ctx, pending.uid, pending.type, defaultPayload(pending.type));
    }
    return;
  }

  switch (board.action) {
    case "turnStart":
      await beginTurn(ctx);
      return;
    case "moving":
      await advanceOneStep(ctx);
      return;
    case "landingEvent":
      await applyLanding(ctx);
      return;
    case "playerEnd":
      await endPlayerTurn(ctx);
      return;
    default:
      // diceRoll / itemChoice / branchChoice / passingEvent は入力待ち
      void hostUid;
      return;
  }
}

/** 未処理の入力を1件だけ処理する。処理したら true。 */
async function consumeInputs(ctx: HostCtx): Promise<boolean> {
  const inputs = ctx.room.inputs;
  if (!inputs) return false;
  const board = ctx.room.board;

  for (const [uid, input] of Object.entries(inputs)) {
    const lastSeq = board?.lastProcessedInputSeq?.[uid];
    const pending = board?.pendingDecision;

    // decision は今の選択待ちに対する返事だけ受け付ける
    const expected =
      input.type === "decision" ? (pending?.id ?? null) : undefined;
    if (!isAcceptable(input, lastSeq, expected)) {
      await clearInput(ctx.roomCode, uid);
      return true;
    }

    await handleInput(ctx, uid, input);
    return true;
  }
  return false;
}

async function handleInput(
  ctx: HostCtx,
  uid: string,
  input: PlayerInput,
): Promise<void> {
  const board = ctx.room.board;
  await clearInput(ctx.roomCode, uid);

  if (input.type === "minigameScore") {
    const paths = scorePaths(ctx, uid, input.payload);
    if (paths) await applyRoomUpdate(ctx.roomCode, paths);
    return;
  }

  if (!board) return;
  await applyRoomUpdate(ctx.roomCode, markProcessed(uid, input.seq));
  const next: Room = {
    ...ctx.room,
    board: {
      ...board,
      lastProcessedInputSeq: {
        ...(board.lastProcessedInputSeq ?? {}),
        [uid]: input.seq,
      },
    },
  };
  const nextCtx: HostCtx = { ...ctx, room: next };

  if (input.type === "roll") {
    if (board.action !== "diceRoll" || board.currentUid !== uid) return;
    await rollDice(nextCtx, uid);
    return;
  }
  if (input.type === "decision") {
    const pending = board.pendingDecision;
    if (!pending || pending.uid !== uid) return;
    await resolveDecision(nextCtx, uid, pending.type, input.payload);
  }
}

/** 選択待ちの種類ごとに処理を振り分ける。 */
async function resolveDecision(
  ctx: HostCtx,
  uid: string,
  type: string,
  payload: unknown,
): Promise<void> {
  switch (type) {
    case "branch":
      await resolveBranch(ctx, uid, payload);
      return;
    case "starPurchase":
      await resolveStar(ctx, uid, payload);
      return;
    case "shop":
      await resolveShop(ctx, uid, payload);
      return;
    case "itemChoice":
      await resolveItemChoice(ctx, uid, payload);
      return;
    case "itemTarget":
      await resolveItemTarget(ctx, uid, payload);
      return;
    default: {
      // eventChoice は「サイコロ待ち」と「ふりなおし確認」の2種類がある
      const options = ctx.room.board?.pendingDecision?.options;
      const kind =
        typeof options === "object" && options !== null
          ? (options as Record<string, unknown>)["kind"]
          : null;
      if (kind === "reroll") {
        await resolveDiceChoice(ctx, uid, payload);
        return;
      }
      if (ctx.room.board?.action === "diceRoll") {
        await rollDice(ctx, uid);
      }
      return;
    }
  }
}

/** 時間切れ・切断時の既定の選択。 */
function defaultPayload(type: string): unknown {
  switch (type) {
    case "starPurchase":
      return { buy: false };
    case "shop":
      return { leave: true };
    case "itemChoice":
      return { skip: true };
    case "itemTarget":
      return {};
    case "branch":
      return {};
    default:
      return {};
  }
}
