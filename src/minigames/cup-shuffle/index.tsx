import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { pickFrom } from "../shared/random";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * コインの入ったカップを目で追いかける。
 * カップの初期配置と入れ替え手順は remainingMs から決定的に決めるので、
 * 全員がまったく同じシャッフルを見る。
 */

const CUPS = 3;
const ROUNDS = 3;
/** 1ラウンドの長さ(ms) */
const ROUND_MS = 5000;
/** ラウンド内の区切り。残り時間がこれ以上なら「見せる」時間 */
const REVEAL_FROM_MS = 3800;
/** 残り時間がこれ以下なら「選ぶ」時間 */
const CHOOSE_UNTIL_MS = 1500;
/** 入れ替え1回にかける時間(ms) */
const SWAP_MS = 380;

/** コインが入っているカップの id */
const COIN_CUP = 0;

/**
 * そのラウンドの、指定回数まで入れ替えたあとの並び。
 * 配列の添字が画面上の位置、値がカップの id。
 */
function orderAt(round: number, swaps: number): number[] {
  const order = [0, 1, 2];
  // 初期位置もラウンドごとに変える
  const start = pickFrom(round, 21, CUPS);
  [order[0], order[start]] = [order[start] as number, order[0] as number];

  for (let i = 0; i < swaps; i++) {
    const a = pickFrom(round * 100 + i, 22, CUPS);
    const b = (a + 1 + pickFrom(round * 100 + i, 23, CUPS - 1)) % CUPS;
    [order[a], order[b]] = [order[b] as number, order[a] as number];
  }
  return order;
}

function CupShuffle({ remainingMs, onScore }: MinigameProps) {
  const [correct, setCorrect] = useState(0);
  const correctRef = useRef(0);
  // ラウンドごとに1回だけ答えられるようにする
  const answeredRef = useRef<number | null>(null);
  const [lastResult, setLastResult] = useState<"o" | "x" | null>(null);

  useEffect(() => {
    onScore(0);
  }, [onScore]);

  const round = Math.floor(remainingMs / ROUND_MS);
  const inRound = remainingMs % ROUND_MS;
  const phase =
    inRound > REVEAL_FROM_MS
      ? "reveal"
      : inRound > CHOOSE_UNTIL_MS
        ? "shuffle"
        : "choose";

  const swaps =
    phase === "reveal"
      ? 0
      : Math.min(
          6,
          Math.floor((REVEAL_FROM_MS - Math.max(inRound, CHOOSE_UNTIL_MS)) / SWAP_MS),
        );
  const order = orderAt(round, swaps);
  const answered = answeredRef.current === round;

  function choose(slot: number): void {
    if (phase !== "choose" || answered || remainingMs <= 0) return;
    answeredRef.current = round;
    const ok = order[slot] === COIN_CUP;
    setLastResult(ok ? "o" : "x");
    if (ok) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }
    onScore(correctRef.current);
  }

  // コインを見せるのは「最初」と「答えたあと」
  const showCoin = phase === "reveal" || answered;

  return (
    <div className="flex size-full flex-col items-center justify-center gap-6 rounded-3xl bg-indigo-950/60 p-4">
      <p className="text-sm text-indigo-100/80">
        {phase === "reveal"
          ? "コインの ばしょを おぼえて！"
          : phase === "shuffle"
            ? "よく見て…"
            : answered
              ? lastResult === "o"
                ? "せいかい！"
                : "はずれ…"
              : "どれに 入ってる？"}
      </p>

      <div className="relative h-32 w-full max-w-xs">
        {order.map((cupId, slot) => (
          <motion.button
            key={cupId}
            type="button"
            onPointerDown={() => choose(slot)}
            animate={{ left: `${slot * 33.4}%` }}
            transition={{ duration: SWAP_MS / 1000, ease: "easeInOut" }}
            className="absolute top-0 flex h-32 w-1/3 flex-col items-center justify-end"
          >
            <span className="text-4xl">
              {showCoin && cupId === COIN_CUP ? "🪙" : ""}
            </span>
            <span className="text-6xl">🥤</span>
          </motion.button>
        ))}
      </div>

      <p className="text-lg font-bold tabular-nums">
        せいかい {correct} / {ROUNDS}
      </p>
    </div>
  );
}

const def: MinigameDef = {
  id: "cup-shuffle",
  title: "どれかな？",
  description:
    "コインの 入った カップを 目で おいかけよう！ シャッフルが おわったら えらんでタップ。3かいで きまる。",
  durationMs: ROUND_MS * ROUNDS,
  higherIsBetter: true,
  Component: CupShuffle,
};

export default def;
