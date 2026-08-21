import { useEffect, useRef, useState } from "react";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * 氷の上を すべって ゴールで ぴったり止まる。
 * 手をはなしても すぐには止まらず、氷なので すべり続ける。
 * どこで手をはなすかを 読むゲーム。ゴールとのズレの合計で判定する。
 */

/** コースの長さ（表示は%） */
const TRACK = 100;
/** ラウンドごとのゴール位置 */
const GOALS = [72, 84, 90] as const;
/** 押している間の加速(/秒) */
const ACCEL = 52;
/** 最高速度(/秒) */
const MAX_SPEED = 46;
/** 氷の摩擦。小さいほど よく すべる(/秒^2) */
const FRICTION = 13;
/** 挑戦できなかったラウンドのズレ。有利にならないよう大きめ */
const MISS_GAP = 40;
/** 結果を見せる時間(ms) */
const SHOW_MS = 1200;

type Stage = "ready" | "slide" | "result";

function IceStop({ remainingMs, onScore }: MinigameProps) {
  const [results, setResults] = useState<number[]>([]);
  const [stage, setStage] = useState<Stage>("ready");
  const [pos, setPos] = useState(0);
  const [lastGap, setLastGap] = useState<number | null>(null);

  const posRef = useRef(0);
  const speedRef = useRef(0);
  const holdRef = useRef(false);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<Stage>("ready");

  const round = results.length;
  const finished = round >= GOALS.length;
  // 結果を見せている間は、いま走ったラウンドのゴール位置を出したままにする
  // （ここで次の位置に動くと、どこで止まったのか分からなくなる）
  const shownRound = stage === "result" ? Math.max(0, round - 1) : round;
  const goal = GOALS[shownRound] ?? 0;

  /** 未挑戦ぶんは MISS_GAP として合計する */
  const scoreOf = (done: number[]): number =>
    done.reduce((sum, value) => sum + value, 0) +
    (GOALS.length - done.length) * MISS_GAP;

  useEffect(() => {
    onScore(scoreOf([]));
    return () => {
      cancelAnimationFrame(frameRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onScore]);

  /** 止まったところで1ラウンド確定 */
  function settle(): void {
    cancelAnimationFrame(frameRef.current);
    // 確定に使うのは、いま走っていたラウンドのゴール
    const runningGoal = GOALS[results.length] ?? 0;
    const gap = Math.round(Math.abs(posRef.current - runningGoal));
    const next = [...results, Math.min(gap, MISS_GAP)];
    setResults(next);
    setLastGap(gap);
    setStage("result");
    stageRef.current = "result";
    onScore(scoreOf(next));

    if (next.length < GOALS.length) {
      timerRef.current = setTimeout(() => {
        posRef.current = 0;
        speedRef.current = 0;
        setPos(0);
        setStage("ready");
        stageRef.current = "ready";
      }, SHOW_MS);
    }
  }

  function loop(now: number): void {
    const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
    lastTimeRef.current = now;

    if (holdRef.current) {
      speedRef.current = Math.min(MAX_SPEED, speedRef.current + ACCEL * dt);
    } else {
      speedRef.current = Math.max(0, speedRef.current - FRICTION * dt);
    }
    posRef.current += speedRef.current * dt;

    // コースから飛び出したら最大ズレ扱いで確定
    if (posRef.current >= TRACK) {
      posRef.current = TRACK;
      setPos(TRACK);
      holdRef.current = false;
      settle();
      return;
    }
    setPos(posRef.current);

    if (!holdRef.current && speedRef.current <= 0.01) {
      settle();
      return;
    }
    frameRef.current = requestAnimationFrame(loop);
  }

  function down(): void {
    if (finished || remainingMs <= 0) return;
    if (stageRef.current === "ready") {
      setStage("slide");
      stageRef.current = "slide";
      holdRef.current = true;
      lastTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame(loop);
      return;
    }
    if (stageRef.current === "slide") holdRef.current = true;
  }

  function up(): void {
    holdRef.current = false;
  }

  return (
    <div
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      className="flex size-full flex-col items-center justify-center gap-5 rounded-3xl bg-sky-950 px-4 select-none"
    >
      <p className="text-sm text-sky-100/80">
        {finished
          ? "おわり！"
          : stage === "ready"
            ? "おしている間 すすむ。はなしても すべるよ！"
            : stage === "slide"
              ? holdRef.current
                ? "すすんでいる…"
                : "すべっている…"
              : lastGap !== null
                ? lastGap === 0
                  ? "ぴったり！"
                  : `ズレ ${lastGap}`
                : ""}
      </p>

      {/* コース */}
      <div className="relative h-16 w-full max-w-sm rounded-xl bg-sky-900/70">
        {/* ゴール帯 */}
        <div
          className="absolute inset-y-0 w-2 -translate-x-1/2 bg-amber-300"
          style={{ left: `${goal}%` }}
        />
        <span
          className="absolute top-0 -translate-x-1/2 text-xs text-amber-200"
          style={{ left: `${goal}%` }}
        >
          ゴール
        </span>
        {/* 自分 */}
        <span
          className="absolute bottom-1 -translate-x-1/2 text-3xl"
          style={{ left: `${Math.min(pos, TRACK)}%` }}
        >
          ⛸️
        </span>
      </div>

      <p className="text-sm text-sky-100/70">
        {shownRound + (finished ? 0 : 1)} / {GOALS.length} かいめ ・ ズレの合計{" "}
        <span className="tabular-nums">{scoreOf(results)}</span>
        <span className="ml-1 text-xs">（小さいほど良い）</span>
      </p>
    </div>
  );
}

const def: MinigameDef = {
  id: "ice-stop",
  title: "つるつるゴール",
  description:
    "氷の上を すべって ゴールで ぴったり 止まろう！ 手をはなしても すぐには 止まらない。3かいの ズレの合計で きまる。",
  durationMs: 16000,
  higherIsBetter: false,
  Component: IceStop,
};

export default def;
