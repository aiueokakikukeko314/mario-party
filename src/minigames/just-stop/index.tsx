import { useEffect, useRef, useState } from "react";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * 時計を見ずに「ちょうど◯秒」で止める。数字は動かない。
 * ズレ(ms)の合計で判定するので小さいほど良い。
 */

/** ラウンドごとの目標時間(ms) */
const TARGETS = [3000, 5000] as const;
/** 挑戦できなかったラウンドの扱い(ms)。有利にならないよう大きめ */
const MISS_MS = 3000;
/** 結果を見せる時間(ms) */
const SHOW_MS = 1100;

function JustStop({ remainingMs, onScore }: MinigameProps) {
  const [results, setResults] = useState<number[]>([]);
  const [stage, setStage] = useState<"ready" | "running" | "result">("ready");
  const [lastGap, setLastGap] = useState<number | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 未挑戦ぶんは MISS_MS として合計する */
  const scoreOf = (done: number[]): number =>
    done.reduce((sum, value) => sum + value, 0) +
    (TARGETS.length - done.length) * MISS_MS;

  useEffect(() => {
    onScore(scoreOf([]));
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
    // scoreOf は results に依存しない純粋計算なので初回だけでよい
  }, [onScore]);

  const round = results.length;
  const finished = round >= TARGETS.length;
  // 結果を見せている間は、いま終えたラウンドの表示のままにする
  const shownRound = stage === "result" ? Math.max(0, round - 1) : round;
  const target = TARGETS[shownRound] ?? 0;

  function press(): void {
    if (finished || remainingMs <= 0) return;

    if (stage === "ready") {
      startedAtRef.current = performance.now();
      setStage("running");
      return;
    }
    if (stage !== "running") return;

    const elapsed = performance.now() - startedAtRef.current;
    const gap = Math.round(Math.abs(elapsed - target));
    const next = [...results, gap];
    setResults(next);
    setLastGap(gap);
    setStage("result");
    onScore(scoreOf(next));

    if (next.length < TARGETS.length) {
      timerRef.current = setTimeout(() => setStage("ready"), SHOW_MS);
    }
  }

  return (
    <button
      type="button"
      onPointerDown={press}
      disabled={finished}
      className={`flex size-full flex-col items-center justify-center gap-4 rounded-3xl px-5 ${
        stage === "running" ? "bg-violet-600" : "bg-slate-800"
      }`}
    >
      <p className="text-sm opacity-80">
        {finished
          ? "おわり！"
          : `${shownRound + 1} / ${TARGETS.length} かいめ`}
      </p>

      <p className="text-4xl font-bold">
        {finished ? "" : `ちょうど ${(target / 1000).toFixed(1)} びょう`}
      </p>

      <p className="h-10 text-2xl font-bold tabular-nums">
        {stage === "ready" && !finished
          ? "タップで スタート"
          : stage === "running"
            ? "…はかっています…"
            : lastGap !== null
              ? `ズレ ${lastGap} ms`
              : ""}
      </p>

      <p className="text-sm opacity-70">
        ズレの合計 <span className="tabular-nums">{scoreOf(results)}</span> ms
        <span className="ml-1 text-xs">（小さいほど良い）</span>
      </p>
    </button>
  );
}

const def: MinigameDef = {
  id: "just-stop",
  title: "ちょうどストップ",
  description:
    "時計は見えません。かんかくだけで ちょうどの びょうすうで タップして 止めよう！ 2かいの ズレの合計で きまる。",
  durationMs: 14000,
  higherIsBetter: false,
  Component: JustStop,
};

export default def;
