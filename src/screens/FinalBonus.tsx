import { motion } from "framer-motion";
import { PLAYER_COLORS } from "../components/PlayerCard";
import { useRoom } from "../store/useRoom";

/**
 * 最終ボーナス賞の発表。ホストが1つずつ revealed を進め、
 * ここはその数だけ表示する（表示はDBの状態に従うだけ）。
 */
export default function FinalBonus() {
  const room = useRoom((s) => s.room);
  const bonus = room?.bonus;
  const players = room?.players ?? {};

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <p className="text-sm tracking-widest text-slate-400">ボーナススター</p>
      <h1 className="text-2xl font-bold">とくべつしょう はっぴょう</h1>

      <ul className="flex w-full max-w-sm flex-col gap-3">
        {(bonus?.awards ?? []).slice(0, bonus?.revealed ?? 0).map((award) => (
          <motion.li
            key={award.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="rounded-xl bg-slate-800 p-4 ring-1 ring-amber-400/40"
          >
            <p className="text-sm text-amber-300">🏆 {award.title}</p>
            <p className="mt-1 text-xs text-slate-400">{award.description}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {award.winners.length === 0 ? (
                <span className="text-sm text-slate-500">がいとうなし</span>
              ) : (
                award.winners.map((uid) => {
                  const player = players[uid];
                  if (!player) return null;
                  const color = PLAYER_COLORS[player.colorIdx];
                  return (
                    <span key={uid} className="flex items-center gap-1 text-sm">
                      <span className={`size-3 rounded-full ${color.dot}`} />
                      {player.name}
                      <span className="text-amber-300">★+1</span>
                    </span>
                  );
                })
              )}
            </div>
          </motion.li>
        ))}
      </ul>

      {(bonus?.revealed ?? 0) < (bonus?.awards.length ?? 0) && (
        <p className="text-sm text-slate-400">つぎの しょう…</p>
      )}
    </main>
  );
}
