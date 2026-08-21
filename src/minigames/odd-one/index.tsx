import { useEffect, useRef, useState } from "react";
import { pickFrom } from "../shared/random";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * ならんだ絵の中から 1つだけ ちがうものを さがす。
 * 出題は remainingMs から決定的に決まるので、全員が同じ問題を解く。
 */

/** 似ているペア。左が たくさん、右が 1つだけ */
const PAIRS = [
  ["🐶", "🐺"],
  ["🍎", "🍅"],
  ["🌞", "🌟"],
  ["🐱", "🐯"],
  ["🍊", "🍑"],
  ["🐸", "🐢"],
  ["⚽", "🏀"],
  ["🐟", "🐠"],
] as const;

const COLS = 4;
const CELLS = 16;
/** 1問の長さ(ms) */
const ROUND_MS = 3000;

function OddOne({ remainingMs, onScore }: MinigameProps) {
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<"o" | "x" | null>(null);
  const correctRef = useRef(0);
  const answeredRef = useRef<number | null>(null);

  useEffect(() => {
    onScore(0);
  }, [onScore]);

  const round = Math.floor(remainingMs / ROUND_MS);
  const pair = PAIRS[pickFrom(round, 51, PAIRS.length)] ?? PAIRS[0];
  const oddIndex = pickFrom(round, 52, CELLS);
  const answered = answeredRef.current === round;
  const active = remainingMs > 0;

  function choose(index: number): void {
    if (!active || answered) return;
    answeredRef.current = round;
    const ok = index === oddIndex;
    setFeedback(ok ? "o" : "x");
    if (ok) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }
    onScore(correctRef.current);
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 rounded-3xl bg-teal-950/70 p-4">
      <p className="text-sm text-teal-100/80">
        {answered
          ? feedback === "o"
            ? "せいかい！"
            : "ちがうよ…"
          : "1つだけ ちがうのは どれ？"}
      </p>

      <div
        className="grid w-full max-w-xs gap-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: CELLS }, (_, index) => (
          <button
            key={index}
            type="button"
            onPointerDown={() => choose(index)}
            className={`flex aspect-square items-center justify-center rounded-lg text-3xl ${
              answered && index === oddIndex
                ? "bg-emerald-500/40"
                : "bg-teal-900/60"
            }`}
          >
            {index === oddIndex ? pair[1] : pair[0]}
          </button>
        ))}
      </div>

      <p className="text-lg font-bold tabular-nums">せいかい {correct}</p>
    </div>
  );
}

const def: MinigameDef = {
  id: "odd-one",
  title: "ちがうのどれ？",
  description:
    "ならんだ絵の中に 1つだけ ちがうものが まざっています。見つけて タップ！ たくさん せいかいしよう。",
  durationMs: 15000,
  higherIsBetter: true,
  Component: OddOne,
};

export default def;
