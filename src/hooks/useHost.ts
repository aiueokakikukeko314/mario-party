import { useEffect, useRef } from "react";
import {
  applyDice,
  applySquareEffect,
  BOARD_SIZE,
  needsStarChoice,
  type PlayersState,
} from "../logic/board";
import { sortPlayers } from "../logic/lobby";
import {
  clearInput,
  initBoard,
  setPhase,
  updateBoard,
  writePlayerStats,
} from "../lib/dbGame";
import { selectIsHost, useRoom } from "../store/useRoom";
import type { Room } from "../types";

/**
 * ホスト端末だけが実行するゲームロジック（CLAUDE.md セクション3）。
 * 乱数（サイコロ・ワープ先）はすべてここで生成する。
 *
 * ここでの setTimeout はコマ移動アニメーションの尺合わせにのみ使う。
 * ミニゲームの同時開始は Phase 3 で startAt の絶対時刻で行う（セクション6）。
 */

/** 1マス進むのにかける時間(ms)。Board3D 側の演出と揃える。 */
export const STEP_MS = 260;
/** 移動しきってからマス効果を出すまでの間 */
const LAND_PAUSE_MS = 350;
/** マス効果を見せてから次の人に渡すまでの間 */
const EFFECT_PAUSE_MS = 900;
/** star の購入確認に返事が来ないときに「やめる」とみなすまでの時間 */
const STAR_CHOICE_TIMEOUT_MS = 15000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 1〜6 の出目。ホストだけが呼ぶ。 */
function rollDice(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function useHost(): void {
  const room = useRoom((s) => s.room);
  const roomCode = useRoom((s) => s.roomCode);
  const myUid = useRoom((s) => s.myUid);
  const isHost = selectIsHost(room, myUid);

  // 非同期処理の最中に再実行されないようにするフラグ
  const busyRef = useRef(false);
  // 起動直後に一度だけ animating の取り残しを掃除したか
  const recoveredRef = useRef(false);
  // star の返事待ちの保険タイマー
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // タイマー発火時に最新の room を見るための箱
  const roomRef = useRef<Room | null>(room);
  roomRef.current = room;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!isHost || roomCode === null || room === null) return;
    if (busyRef.current) return;

    const players = room.players ?? {};
    const ordered = sortPlayers(players);
    if (ordered.length === 0) return;

    const run = (task: Promise<void>) => {
      busyRef.current = true;
      void task.finally(() => {
        busyRef.current = false;
      });
    };

    // --- ボード未初期化なら作る ---
    if (room.meta.phase === "board" && room.board === undefined) {
      const first = ordered[0];
      if (!first) return;
      run(initBoard(roomCode, first.uid));
      return;
    }

    if (room.meta.phase !== "board" || room.board === undefined) return;
    const board = room.board;

    // animating を立てられるのはホストだけなので、ホスト起動直後に true のままなら
    // 前のホストが移動中に落ちた残骸。解除しないと進行が止まる。
    if (board.animating && !recoveredRef.current) {
      recoveredRef.current = true;
      run(updateBoard(roomCode, { animating: false }));
      return;
    }
    recoveredRef.current = true;

    // --- star マスの購入確認待ち ---
    if (board.pending === "star") {
      const choice = room.inputs?.[board.currentUid];
      if (choice?.type === "starChoice") {
        clearTimer();
        run(
          handleStarChoice(roomCode, room, board.currentUid, choice.value === true),
        );
        return;
      }
      // 返事が来ないまま固まらないよう保険をかける（切断など）
      if (timerRef.current === null) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          const latest = roomRef.current;
          if (latest?.board?.pending !== "star") return;
          run(
            handleStarChoice(roomCode, latest, latest.board.currentUid, false),
          );
        }, STAR_CHOICE_TIMEOUT_MS);
      }
      return;
    }
    clearTimer();

    if (board.animating) return;

    // --- 手番プレイヤーの「振る」入力を処理する ---
    if (room.inputs?.[board.currentUid]?.type !== "roll") return;
    run(handleRoll(roomCode, room, board.currentUid));
  }, [isHost, roomCode, room]);
}

/** サイコロを振ってコマを進め、マス効果まで処理する。 */
async function handleRoll(
  roomCode: string,
  room: Room,
  uid: string,
): Promise<void> {
  const players = room.players ?? {};
  if (!room.board) return;

  // 同じ入力を二度処理しないよう、先に消す
  await clearInput(roomCode, uid);

  const dice = rollDice();
  const moved = applyDice(players, uid, dice);
  const movedPlayer = moved[uid];
  if (!movedPlayer) return;

  // 出目を見せ、コマを進める（各端末が pos の変化をアニメーションする）
  await updateBoard(roomCode, { dice, animating: true });
  await writePlayerStats(roomCode, uid, {
    coins: movedPlayer.coins,
    stars: movedPlayer.stars,
    pos: movedPlayer.pos,
  });

  await wait(dice * STEP_MS + LAND_PAUSE_MS);

  // star マスは本人に買うかどうか聞く。返事は inputs 経由で戻ってくる
  if (needsStarChoice(moved, uid)) {
    await updateBoard(roomCode, { animating: false, pending: "star" });
    return;
  }

  // warp の移動先もホストが決める
  const warpTarget = Math.floor(Math.random() * BOARD_SIZE);
  await applyEffectAndAdvance(roomCode, moved, uid, {
    warpTarget,
    buyStar: false,
  });
}

/** 本人が選んだ「買う / やめる」を反映して手番を進める。 */
async function handleStarChoice(
  roomCode: string,
  room: Room,
  uid: string,
  buyStar: boolean,
): Promise<void> {
  await clearInput(roomCode, uid);
  await updateBoard(roomCode, { pending: null });
  await applyEffectAndAdvance(roomCode, room.players ?? {}, uid, {
    warpTarget: 0, // star マスなので使われない
    buyStar,
  });
}

async function applyEffectAndAdvance(
  roomCode: string,
  players: PlayersState,
  uid: string,
  ctx: { warpTarget: number; buyStar: boolean },
): Promise<void> {
  const { players: after } = applySquareEffect(players, uid, ctx);
  const afterPlayer = after[uid];
  if (afterPlayer) {
    await writePlayerStats(roomCode, uid, {
      coins: afterPlayer.coins,
      stars: afterPlayer.stars,
      pos: afterPlayer.pos,
    });
  }

  await wait(EFFECT_PAUSE_MS);

  // 次の人へ。全員振り終わっていたらミニゲームへ
  const ordered = sortPlayers(players);
  const currentIndex = ordered.findIndex((entry) => entry.uid === uid);
  const next = ordered[currentIndex + 1];
  if (next) {
    await updateBoard(roomCode, {
      currentUid: next.uid,
      dice: null,
      animating: false,
    });
  } else {
    await updateBoard(roomCode, { animating: false });
    await setPhase(roomCode, "minigameIntro");
  }
}
