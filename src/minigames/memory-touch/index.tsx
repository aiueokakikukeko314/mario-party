import { useCallback, useEffect, useRef, useState } from "react";
import { pickFrom } from "../shared/random";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * 光った順番を おぼえて 同じ順に タップする。
 * 正解するたびに 1つ長くなる。到達した長さがスコア。
 *
 * 光る順番は固定の数列（全員同じ）なので、運の差が出ない。
 */

const PANELS = [
  { on: "bg-rose-400", off: "bg-rose-900/70" },
  { on: "bg-sky-400", off: "bg-sky-900/70" },
  { on: "bg-emerald-400", off: "bg-emerald-900/70" },
  { on: "bg-amber-300", off: "bg-amber-900/70" },
] as const;

/** 最初に覚える長さ */
const START_LENGTH = 3;
/** 1つ光っている時間(ms) */
const FLASH_MS = 480;

/** i 番目に光るパネル。全端末で同じ並びになる。 */
const panelAt = (index: number): number => pickFrom(index, 31, PANELS.length);

function MemoryTouch({ remainingMs, onScore }: MinigameProps) {
  const [length, setLength] = useState(START_LENGTH);
  const [showing, setShowing] = useState(0); // 何個目を光らせているか（-1で消灯）
  const [lit, setLit] = useState<number | null>(null);
  const [phase, setPhase] = useState<"show" | "input" | "result">("show");
  const [inputIndex, setInputIndex] = useState(0);
  const [best, setBest] = useState(0);

  const bestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lengthRef = useRef(START_LENGTH);

  useEffect(() => {
    onScore(0);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onScore]);

  /** お手本を1つずつ光らせる */
  const runShow = useCallback((count: number, step: number) => {
    if (step >= count) {
      setLit(null);
      setPhase("input");
      setInputIndex(0);
      return;
    }
    setLit(panelAt(step));
    setShowing(step);
    timerRef.current = setTimeout(() => {
      setLit(null);
      timerRef.current = setTimeout(() => runShow(count, step + 1), 140);
    }, FLASH_MS);
  }, []);

  useEffect(() => {
    if (phase !== "show") return;
    runShow(lengthRef.current, 0);
  }, [phase, runShow]);

  function tap(index: number): void {
    if (phase !== "input" || remainingMs <= 0) return;

    if (index !== panelAt(inputIndex)) {
      // まちがえたら 最初の長さから やり直し
      setPhase("result");
      timerRef.current = setTimeout(() => {
        lengthRef.current = START_LENGTH;
        setLength(START_LENGTH);
        setPhase("show");
      }, 700);
      return;
    }

    const next = inputIndex + 1;
    if (next < lengthRef.current) {
      setInputIndex(next);
      return;
    }

    // 1セット正解
    bestRef.current = Math.max(bestRef.current, lengthRef.current);
    setBest(bestRef.current);
    onScore(bestRef.current);
    setPhase("result");
    timerRef.current = setTimeout(() => {
      lengthRef.current += 1;
      setLength(lengthRef.current);
      setPhase("show");
    }, 700);
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-5 rounded-3xl bg-slate-800 p-4">
      <p className="text-sm text-slate-300">
        {phase === "show"
          ? `おぼえて… ${showing + 1} / ${length}`
          : phase === "input"
            ? `おなじ順に タップ！ ${inputIndex} / ${length}`
            : "..."}
      </p>

      <div className="grid w-full max-w-xs grid-cols-2 gap-3">
        {PANELS.map((panel, index) => (
          <button
            key={index}
            type="button"
            onPointerDown={() => tap(index)}
            className={`aspect-square rounded-2xl transition-colors duration-100 ${
              lit === index ? panel.on : panel.off
            }`}
          />
        ))}
      </div>

      <p className="text-lg font-bold tabular-nums">
        さいこう {best} こ
      </p>
    </div>
  );
}

const def: MinigameDef = {
  id: "memory-touch",
  title: "おぼえてタッチ",
  description:
    "光った じゅんばんを おぼえて、おなじ順に タップしよう！ せいかいすると 1つ ふえる。どこまで いけるかな？",
  durationMs: 16000,
  higherIsBetter: true,
  Component: MemoryTouch,
};

export default def;
