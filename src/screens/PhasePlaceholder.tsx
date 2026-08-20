import type { Phase } from "../types";
import { useRoom } from "../store/useRoom";

/**
 * Phase 2 以降で実装する画面の仮表示。
 * lobby 以外のフェーズに入ったことが確認できればよい。
 */
export default function PhasePlaceholder({ phase }: { phase: Phase }) {
  const leave = useRoom((s) => s.leave);
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-slate-400">現在のフェーズ</p>
      <p className="text-3xl font-bold">{phase}</p>
      <p className="max-w-xs text-center text-sm text-slate-400">
        この画面は Phase 2 以降で実装します。
      </p>
      <button
        type="button"
        onClick={() => void leave()}
        className="mt-4 min-h-14 rounded-xl bg-slate-700 px-8 text-base"
      >
        ホームにもどる
      </button>
    </main>
  );
}
