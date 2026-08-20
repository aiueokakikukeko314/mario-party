import { useEffect, useState } from "react";
import { serverNow } from "../lib/time";

/**
 * サーバー補正済みの現在時刻を毎フレーム返す（CLAUDE.md セクション6）。
 * カウントダウンや残り時間は必ずこれを基準にする。
 * setTimeout の相対時間で開始タイミングを組まないこと。
 */
export function useServerNow(): number {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setNow(serverNow());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return now;
}
