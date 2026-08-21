import { useEffect, useRef, useState } from "react";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * 左右に往復するバーを1回タップで止める。中央からのズレが小さいほど高得点。
 * 3回ぶんの合計で判定する（ズレの合計なので小さい方が good）。
 */

const ROUNDS = 3;
/** バーが往復する周期(ms) */
const SWEEP_MS = 1400;
/** 1回のズレの最大値。中央からの距離を 0〜100 で表す */
const MAX_DEVIATION = 100;
/** 止めたあと結果を見せる時間(ms) */
const FREEZE_MS = 850;

/** 時刻から 0〜1 の三角波を作る（0=左端, 1=右端）。 */
function barPosition(timeMs: number): number {
  const u = ((timeMs / SWEEP_MS) % 1 + 1) % 1;
  return u < 0.5 ? u * 2 : 2 - u * 2;
}

/** 中央からのズレを 0〜MAX_DEVIATION で返す。 */
function deviationOf(position: number): number {
  return Math.round(Math.abs(position - 0.5) * 2 * MAX_DEVIATION);
}

function TimingStop({ remainingMs, onScore }: MinigameProps) {
  const [results, setResults] = useState<number[]>([]);
  const [frozen, setFrozen] = useState<{ position: number; deviation: number } | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 未挑戦のラウンドは最大ズレとして数える。
   * 途中でやめた人の合計が小さくなって有利にならないようにするため。
   */
  const scoreOf = (done: number[]): number =>
    done.reduce((sum, value) => sum + value, 0) +
    (ROUNDS - done.length) * MAX_DEVIATION;

  useEffect(() => {
    onScore(scoreOf([]));
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onScore]);

  const finished = results.length >= ROUNDS;
  const position = frozen ? frozen.position : barPosition(remainingMs);

  function stop(): void {
    if (frozen || finished || remainingMs <= 0) return;
    const stopped = barPosition(remainingMs);
    const deviation = deviationOf(stopped);
    const next = [...results, deviation];
    setFrozen({ position: stopped, deviation });
    setResults(next);
    onScore(scoreOf(next));

    timerRef.current = setTimeout(() => setFrozen(null), FREEZE_MS);
  }

  return (
    <button
      type="button"
      onPointerDown={stop}
      disabled={finished}
      className="flex size-full flex-col items-center justify-center gap-6 rounded-3xl bg-slate-800 px-5 disabled:opacity-70"
    >
      <p className="text-sm text-slate-400">
        {finished ? "おわり！" : `${results.length + 1} / ${ROUNDS} かいめ`}
      </p>

      {/* バーの通り道。中央の帯に近いほど高得点 */}
      <div className="relative h-16 w-full overflow-hidden rounded-xl bg-slate-900">
        <div className="absolute inset-y-0 left-1/2 w-12 -translate-x-1/2 rounded-lg bg-emerald-500/25" />
        <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-emerald-400" />
        <div
          className={`absolute inset-y-2 w-3 rounded-full ${
            frozen ? "bg-amber-300" : "bg-white"
          }`}
          style={{ left: `calc(${position * 100}% - 6px)` }}
        />
      </div>

      <p className="h-8 text-2xl font-bold tabular-nums">
        {frozen ? `ズレ ${frozen.deviation}` : finished ? "" : "タップで とめる！"}
      </p>

      <p className="text-sm text-slate-400">
        ズレの合計 <span className="tabular-nums">{scoreOf(results)}</span>
        <span className="ml-1 text-xs">（小さいほど良い）</span>
      </p>
    </button>
  );
}

const def: MinigameDef = {
  id: "timing-stop",
  title: "ぴったりストップ",
  description:
    "うごくバーを まん中で とめよう！ 3かい ちょうせんして ズレの合計が いちばん 小さい人の かち。",
  durationMs: 12000,
  higherIsBetter: false,
  Component: TimingStop,
};

export default def;
