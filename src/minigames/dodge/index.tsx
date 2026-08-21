import { useEffect, useRef, useState } from "react";
import { pickFrom } from "../shared/random";
import type { MinigameDef, MinigameProps } from "../types";

/**
 * 落ちてくる岩をよける。3レーンのうち安全なのは毎回1つだけなので、
 * 動かないと当たる。よけた数がスコア。
 *
 * 安全レーンは remainingMs から決定的に決まるので全員同じ配置になる。
 */

const LANES = 3;
/** 1つの岩が降りきるまでの時間(ms) */
const FALL_MS = 1150;

/** その回に安全なレーン */
const safeLaneAt = (step: number): number => pickFrom(step, 41, LANES);

function Dodge({ remainingMs, onScore }: MinigameProps) {
  const [lane, setLane] = useState(1);
  const [dodged, setDodged] = useState(0);
  const [hit, setHit] = useState(false);

  const laneRef = useRef(1);
  const dodgedRef = useRef(0);
  // 判定済みの step（1つの岩につき1回だけ判定する）
  const judgedRef = useRef<number | null>(null);

  useEffect(() => {
    onScore(0);
  }, [onScore]);

  const step = Math.floor(remainingMs / FALL_MS);
  const safe = safeLaneAt(step);
  // 0 → 1 で落下。step が変わる直前が着弾
  const progress = 1 - (remainingMs % FALL_MS) / FALL_MS;
  const active = remainingMs > 0;

  // 岩が入れ替わった瞬間に、直前の岩の当たり判定をする
  if (active && judgedRef.current !== null && judgedRef.current !== step) {
    const judgedSafe = safeLaneAt(judgedRef.current);
    if (laneRef.current === judgedSafe) {
      dodgedRef.current += 1;
    }
  }
  if (judgedRef.current !== step) judgedRef.current = step;

  // 表示用の値をレンダー後に反映する
  useEffect(() => {
    if (dodgedRef.current !== dodged) {
      setDodged(dodgedRef.current);
      onScore(dodgedRef.current);
    }
    setHit(active && progress > 0.82 && laneRef.current !== safe);
  }, [step, progress, active, safe, dodged, onScore]);

  function move(next: number): void {
    if (!active) return;
    laneRef.current = next;
    setLane(next);
  }

  return (
    <div className="flex size-full flex-col gap-2 rounded-3xl bg-slate-900 p-3">
      <p className="text-center text-sm text-slate-300">
        あんぜんな ばしょへ にげろ！
      </p>

      <div className="relative min-h-0 flex-1">
        <div className="grid size-full grid-cols-3 gap-2">
          {Array.from({ length: LANES }, (_, index) => (
            <button
              key={index}
              type="button"
              onPointerDown={() => move(index)}
              className={`relative overflow-hidden rounded-2xl ${
                lane === index ? "bg-slate-700 ring-2 ring-sky-400" : "bg-slate-800"
              }`}
            >
              {/* 落ちてくる岩 */}
              {active && index !== safe && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 text-4xl"
                  style={{ top: `${progress * 78}%` }}
                >
                  🪨
                </span>
              )}
              {/* 自分 */}
              {lane === index && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-4xl">
                  {hit ? "💥" : "🙂"}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xl font-bold tabular-nums">
        よけた {dodged}
      </p>
    </div>
  );
}

const def: MinigameDef = {
  id: "dodge",
  title: "よけろ！",
  description:
    "上から 岩が おちてくる！ あいている ばしょを タップして にげよう。あんぜんなのは 毎回1つだけ。",
  durationMs: 11000,
  higherIsBetter: true,
  Component: Dodge,
};

export default def;
