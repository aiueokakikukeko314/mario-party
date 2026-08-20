import { useEffect, useRef, useState } from "react";
import type { MinigameDef, MinigameProps } from "../types";

/** 制限時間内に何回タップできるかを競う。 */
function TapBattle({ remainingMs, onScore }: MinigameProps) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  // 一度もタップしなくても「0点」として集計されるように初期報告する
  useEffect(() => {
    onScore(0);
  }, [onScore]);

  function tap(): void {
    if (remainingMs <= 0) return;
    countRef.current += 1;
    setCount(countRef.current);
    onScore(countRef.current);
  }

  return (
    <button
      type="button"
      onPointerDown={tap}
      className="flex size-full flex-col items-center justify-center gap-2 rounded-3xl bg-sky-600 active:bg-sky-500"
    >
      <span className="text-7xl font-bold tabular-nums">{count}</span>
      <span className="text-base text-sky-100">れんだ！</span>
    </button>
  );
}

const def: MinigameDef = {
  id: "tap-battle",
  title: "れんだバトル",
  description: "せいげんじかんない に できるだけ たくさん タップしよう！",
  durationMs: 5000,
  higherIsBetter: true,
  Component: TapBattle,
};

export default def;
