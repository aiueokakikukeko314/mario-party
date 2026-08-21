import { useCallback, useEffect, useRef, useState } from "react";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * ランダムな待機のあと画面が変色する。そこからタップまでのミリ秒を測る。
 * フライング（変色前のタップ）は +2000ms のペナルティ。3回の平均で判定する。
 */

const ROUNDS = 3;
/** 変色までの待ち時間の範囲(ms) */
const WAIT_MIN_MS = 1000;
const WAIT_MAX_MS = 4000;
/** フライング1回ごとのペナルティ(ms) */
const FLYING_PENALTY_MS = 2000;
/** 挑戦できなかったラウンドの扱い(ms)。有利にならないよう大きめにする */
const UNPLAYED_MS = 3000;
/** 結果を見せる時間(ms) */
const SHOW_MS = 900;

type Stage = "waiting" | "go" | "result";

function Reflex({ remainingMs, onScore }: MinigameProps) {
  const [results, setResults] = useState<number[]>([]);
  const [stage, setStage] = useState<Stage>("waiting");
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [flying, setFlying] = useState(false);

  // 変色した時刻と、そのラウンドで積み上がったペナルティ
  const goAtRef = useRef<number | null>(null);
  const penaltyRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 未挑戦のラウンドは UNPLAYED_MS として平均を出す。 */
  const scoreOf = useCallback((done: number[]): number => {
    const total =
      done.reduce((sum, value) => sum + value, 0) +
      (ROUNDS - done.length) * UNPLAYED_MS;
    return Math.round(total / ROUNDS);
  }, []);

  /** 次のラウンドの待機を始める。 */
  const startRound = useCallback(() => {
    goAtRef.current = null;
    penaltyRef.current = 0;
    setFlying(false);
    setStage("waiting");
    const waitMs =
      WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
    timerRef.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setStage("go");
    }, waitMs);
  }, []);

  useEffect(() => {
    onScore(scoreOf([]));
    startRound();
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onScore, scoreOf, startRound]);

  const finished = results.length >= ROUNDS;

  function tap(): void {
    if (finished || stage === "result" || remainingMs <= 0) return;

    // フライング: ラウンドは終わらせず、ペナルティだけ積んで待機を続ける
    if (stage === "waiting") {
      penaltyRef.current += FLYING_PENALTY_MS;
      setFlying(true);
      return;
    }

    const goAt = goAtRef.current;
    if (goAt === null) return;
    const reaction = Math.round(performance.now() - goAt) + penaltyRef.current;
    const next = [...results, reaction];
    setResults(next);
    setLastMs(reaction);
    setStage("result");
    onScore(scoreOf(next));

    if (next.length < ROUNDS) {
      timerRef.current = setTimeout(startRound, SHOW_MS);
    }
  }

  const background = finished
    ? "bg-slate-800"
    : stage === "go"
      ? "bg-emerald-500"
      : stage === "result"
        ? "bg-slate-700"
        : "bg-rose-900";

  return (
    <button
      type="button"
      onPointerDown={tap}
      disabled={finished}
      className={`flex size-full flex-col items-center justify-center gap-3 rounded-3xl px-5 ${background}`}
    >
      <p className="text-sm opacity-80">
        {finished ? "おわり！" : `${results.length + 1} / ${ROUNDS} かいめ`}
      </p>

      <p className="text-3xl font-bold">
        {finished
          ? ""
          : stage === "go"
            ? "いま！"
            : stage === "result"
              ? `${lastMs} ms`
              : "まて…"}
      </p>

      {flying && stage === "waiting" && (
        <p className="text-sm text-rose-200">
          フライング！ +{FLYING_PENALTY_MS} ms
        </p>
      )}

      <p className="text-sm opacity-80">
        へいきん <span className="tabular-nums">{scoreOf(results)}</span> ms
        <span className="ml-1 text-xs">（小さいほど良い）</span>
      </p>
    </button>
  );
}

const def: MinigameDef = {
  id: "reflex",
  title: "はんしゃしんけい",
  description:
    "画面が みどりに かわったら すぐタップ！ はやくタップする前に おしたら +2000ms のペナルティ。3かいの へいきんで きまる。",
  durationMs: 18000,
  higherIsBetter: false,
  Component: Reflex,
};

export default def;
