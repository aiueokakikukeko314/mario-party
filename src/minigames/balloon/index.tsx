import { useEffect, useRef, useState } from "react";
import { pickFrom } from "../shared/random";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * ふうせんを ふくらませる。大きいほど高得点だが、
 * 限界をこえると われて そのラウンドは0点。どこでやめるかの かけひき。
 *
 * われる大きさは ラウンドごとに決定的に決まるので、全員 同じ条件。
 */

const ROUNDS = 3;
/** ふくらむ速さ(/秒) */
const RATE = 34;
/** われる大きさの下限と、そこからの ばらつき */
const BURST_MIN = 55;
const BURST_RANGE = 40;
/** 結果を見せる時間(ms) */
const SHOW_MS = 900;

const burstAt = (round: number): number =>
  BURST_MIN + pickFrom(round, 61, BURST_RANGE);

function Balloon({ remainingMs, onScore }: MinigameProps) {
  const [results, setResults] = useState<number[]>([]);
  const [size, setSize] = useState(0);
  const [state, setState] = useState<"idle" | "blow" | "done">("idle");

  const sizeRef = useRef(0);
  const holdRef = useRef(false);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  const round = results.length;
  const finished = round >= ROUNDS;
  const total = results.reduce((sum, value) => sum + value, 0);

  useEffect(() => {
    onScore(0);
    return () => {
      cancelAnimationFrame(frameRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onScore]);

  /** ラウンドを確定する。burst なら0点 */
  function finish(burst: boolean, results0: number[]): void {
    cancelAnimationFrame(frameRef.current);
    busyRef.current = true;
    holdRef.current = false;
    const gained = burst ? 0 : Math.round(sizeRef.current);
    const next = [...results0, gained];
    setResults(next);
    setState("done");
    onScore(next.reduce((sum, value) => sum + value, 0));

    if (next.length < ROUNDS) {
      timerRef.current = setTimeout(() => {
        sizeRef.current = 0;
        setSize(0);
        setState("idle");
        busyRef.current = false;
      }, SHOW_MS);
    }
  }

  function loop(now: number): void {
    const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
    lastTimeRef.current = now;
    if (!holdRef.current) return;

    sizeRef.current += RATE * dt;
    setSize(sizeRef.current);

    if (sizeRef.current >= burstAt(round)) {
      finish(true, results);
      return;
    }
    frameRef.current = requestAnimationFrame(loop);
  }

  function down(): void {
    if (finished || busyRef.current || remainingMs <= 0) return;
    holdRef.current = true;
    setState("blow");
    lastTimeRef.current = performance.now();
    frameRef.current = requestAnimationFrame(loop);
  }

  function up(): void {
    if (!holdRef.current || busyRef.current) return;
    finish(false, results);
  }

  const scale = 0.5 + Math.min(size, 100) / 90;
  const popped = state === "done" && (results[round - 1] ?? 0) === 0;

  return (
    <div
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      className="flex size-full flex-col items-center justify-center gap-4 rounded-3xl bg-rose-950/60 px-4 select-none"
    >
      <p className="text-sm text-rose-100/80">
        {finished
          ? "おわり！"
          : state === "blow"
            ? "おしている間 ふくらむ…はなすと かくてい"
            : popped
              ? "われた！ 0てん"
              : "おして ふくらませよう"}
      </p>

      <div className="flex h-40 items-center justify-center">
        <span
          className="text-7xl transition-transform duration-75"
          style={{ transform: `scale(${popped ? 1 : scale})` }}
        >
          {popped ? "💥" : "🎈"}
        </span>
      </div>

      <p className="text-2xl font-bold tabular-nums">{Math.round(size)}</p>
      <p className="text-sm text-rose-100/70">
        {round + (finished ? 0 : 1)} / {ROUNDS} かいめ ・ 合計{" "}
        <span className="tabular-nums">{total}</span>
      </p>
    </div>
  );
}

const def: MinigameDef = {
  id: "balloon",
  title: "ふうせんチキン",
  description:
    "おしている間 ふうせんが ふくらむ。大きいほど 高とくてん！ でも われたら そのかいは 0てん。3かいの 合計で きまる。",
  durationMs: 15000,
  higherIsBetter: true,
  Component: Balloon,
};

export default def;
