import { useEffect, useRef, useState } from "react";
import { sortPlayers } from "../logic/lobby";
import { pickMinigame } from "../minigames/registry";
import {
  finishTurn,
  initBoard,
  setPhase,
  startMinigame,
  updateBoard,
} from "../lib/dbGame";
import { collectScores } from "../lib/hostMinigame";
import { handleRoll, handleStarChoice } from "../lib/hostTurn";
import {
  INTRO_MS,
  RESULT_MS,
  SCORE_GRACE_MS,
  STAR_CHOICE_TIMEOUT_MS,
  TICK_MS,
} from "../lib/hostTiming";
import { serverNow } from "../lib/time";
import { selectIsHost, useRoom } from "../store/useRoom";
import type { Room } from "../types";

/**
 * ホスト端末だけが実行するゲームロジック（CLAUDE.md セクション3）。
 * 乱数（サイコロ・ワープ先）はすべてここで生成する。
 *
 * ここでの setTimeout はコマ移動アニメーションの尺合わせにのみ使う。
 * ミニゲームの同時開始は startAt という絶対時刻で行う（セクション6）。
 */


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

  // ミニゲーム系のフェーズは「時刻」で進むため、room の更新が無くても再評価する
  const [tick, setTick] = useState(0);
  const phase = room?.meta.phase ?? null;
  useEffect(() => {
    if (!isHost) return;
    if (phase !== "minigameIntro" && phase !== "minigame" && phase !== "minigameResult") {
      return;
    }
    const id = setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => clearInterval(id);
  }, [isHost, phase]);

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

    // --- ミニゲーム: 選出と同時開始の予約 ---
    if (room.meta.phase === "minigameIntro") {
      if (!room.minigame?.id) {
        const game = pickMinigame(Math.random());
        if (!game) return;
        const startAt = serverNow() + INTRO_MS;
        run(
          startMinigame(roomCode, game.id, startAt, startAt + game.durationMs),
        );
      } else if (serverNow() >= (room.minigame.startAt ?? Infinity)) {
        run(setPhase(roomCode, "minigame"));
      }
      return;
    }

    // --- ミニゲーム: スコア収集と締め切り ---
    if (room.meta.phase === "minigame") {
      run(collectScores(roomCode, room, ordered));
      return;
    }

    // --- 結果表示が終わったら次のターンへ ---
    if (room.meta.phase === "minigameResult") {
      const scores = room.minigame?.scores;
      const allScored = ordered.every(
        (entry) => typeof scores?.[entry.uid] === "number",
      );
      // 全員そろって終わったなら猶予は要らない
      const base =
        (room.minigame?.endAt ?? 0) + (allScored ? 0 : SCORE_GRACE_MS);
      if (serverNow() < base + RESULT_MS) return;
      const first = ordered[0];
      if (!first) return;
      run(
        finishTurn(
          roomCode,
          room.board?.turn ?? 1,
          room.meta.maxTurns,
          first.uid,
        ),
      );
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
  }, [isHost, roomCode, room, tick]);
}
