import { useEffect, useRef, useState } from "react";
import { pickFrom } from "../shared/random";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * 3x3 から顔を出すモグラをたたく。ばくだんを叩くと減点。
 * 出現位置は remainingMs から決定的に決めるので、全員の画面に同じ配置が出る。
 */

const CELLS = 9;
/** 1体あたりの出ている時間(ms) */
const STEP_MS = 720;
/** 何回に1回ばくだんにするか */
const BOMB_EVERY = 4;

function targetAt(step: number): { cell: number; bomb: boolean } {
  return {
    cell: pickFrom(step, 11, CELLS),
    bomb: pickFrom(step, 12, BOMB_EVERY) === 0,
  };
}

function WhackMole({ remainingMs, onScore }: MinigameProps) {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  // 1体につき1回しか当たらないよう、処理済みの step を覚える
  const doneStepRef = useRef<number | null>(null);

  useEffect(() => {
    onScore(0);
  }, [onScore]);

  const step = Math.floor(remainingMs / STEP_MS);
  const { cell, bomb } = targetAt(step);
  const active = remainingMs > 0;

  function hit(index: number): void {
    if (!active || index !== cell) return;
    if (doneStepRef.current === step) return;
    doneStepRef.current = step;
    scoreRef.current = Math.max(0, scoreRef.current + (bomb ? -1 : 1));
    setScore(scoreRef.current);
    onScore(scoreRef.current);
  }

  const struck = doneStepRef.current === step;

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 rounded-3xl bg-amber-900/30 p-4">
      <p className="text-sm text-amber-100/80">
        モグラを たたこう！ ばくだんは ダメ
      </p>
      <div className="grid w-full max-w-xs grid-cols-3 gap-2">
        {Array.from({ length: CELLS }, (_, index) => {
          const isTarget = active && index === cell && !struck;
          return (
            <button
              key={index}
              type="button"
              onPointerDown={() => hit(index)}
              className="flex aspect-square items-center justify-center rounded-2xl bg-amber-950/60 text-4xl active:bg-amber-800/60"
            >
              {isTarget ? (bomb ? "💣" : "🐹") : ""}
            </button>
          );
        })}
      </div>
      <p className="text-2xl font-bold tabular-nums">{score} てん</p>
    </div>
  );
}

const def: MinigameDef = {
  id: "whack-mole",
  title: "もぐらたたき",
  description:
    "あなから出てくる モグラを たたこう！ ばくだん💣を たたくと 1てん へるので きをつけて。",
  durationMs: 9000,
  higherIsBetter: true,
  Component: WhackMole,
};

export default def;
