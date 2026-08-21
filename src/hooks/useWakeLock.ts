import { useEffect } from "react";

/**
 * 遊んでいる間、画面が消えないようにする（CLAUDE.md セクション11）。
 * 対応していない端末では何も起きない。失敗は握りつぶす。
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async (): Promise<void> => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // 非対応・拒否されても無視する
      }
    };

    // タブに戻ったときは取り直す（バックグラウンドで自動解除されるため）
    const onVisible = (): void => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
