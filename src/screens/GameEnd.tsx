import { useEffect } from "react";
import { motion } from "framer-motion";
import { PLAYER_COLORS } from "../components/PlayerCard";
import { rankPlayers, winnersOf } from "../logic/result";
import { playSound } from "../lib/sound";
import { useRoom } from "../store/useRoom";

/**
 * 最終結果（CLAUDE.md セクション8: スター→コインの順で判定）。
 * 順位付けは src/logic/result.ts の純関数に任せ、ここは表示だけ。
 */
export default function GameEnd() {
  const room = useRoom((s) => s.room);
  const myUid = useRoom((s) => s.myUid);
  const leave = useRoom((s) => s.leave);

  const ranked = rankPlayers(room?.players ?? {});
  const winners = winnersOf(ranked);
  const iWon = winners.some((entry) => entry.uid === myUid);

  useEffect(() => {
    playSound("win");
  }, []);

  return (
    <main className="flex h-full flex-col items-center justify-between gap-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
        <motion.p
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="text-sm tracking-widest text-slate-400"
        >
          ゲームしゅうりょう
        </motion.p>

        {/* 1位の演出 */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 11, delay: 0.2 }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-6xl">👑</span>
          <p className="text-center text-3xl font-bold text-amber-300">
            {winners.map((entry) => entry.player.name).join(" と ")}
          </p>
          <p className="text-sm text-slate-300">
            {winners.length > 1 ? "どうてん1い！" : "ゆうしょう！"}
          </p>
          {iWon && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-sm text-amber-200"
            >
              おめでとう！
            </motion.p>
          )}
        </motion.div>

        {/* 全員の結果 */}
        <ul className="flex w-full max-w-sm flex-col gap-2">
          {ranked.map((entry, index) => {
            const color = PLAYER_COLORS[entry.player.colorIdx];
            return (
              <motion.li
                key={entry.uid}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.15 }}
                className={`flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 ${
                  entry.rank === 1
                    ? "bg-amber-400/15 ring-1 ring-amber-400/60"
                    : entry.uid === myUid
                      ? "bg-slate-700 ring-1 ring-sky-500"
                      : "bg-slate-800"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-lg font-bold text-slate-300">
                  {entry.rank}
                </span>
                <span className={`size-4 shrink-0 rounded-full ${color.dot}`} />
                <span className="flex-1 truncate text-base font-medium">
                  {entry.player.name}
                </span>
                <span className="shrink-0 tabular-nums text-amber-300">
                  ★{entry.player.stars}
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-slate-300">
                  {entry.player.coins}
                </span>
              </motion.li>
            );
          })}
        </ul>

        <p className="text-xs text-slate-500">
          スターの数 → コインの数 の順で じゅんいを きめています
        </p>
      </div>

      <button
        type="button"
        onClick={() => void leave()}
        className="min-h-14 w-full max-w-sm rounded-xl bg-slate-700 text-base font-bold"
      >
        ホームにもどる
      </button>
    </main>
  );
}
