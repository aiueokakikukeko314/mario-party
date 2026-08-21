import { useEffect } from "react";
import { motion } from "framer-motion";
import { PLAYER_COLORS } from "../components/PlayerCard";
import { ffaReward } from "../logic/minigame";
import { findMinigame } from "../minigames/registry";
import { selectPlayers, useRoom } from "../store/useRoom";
import { playSound } from "../lib/sound";

const MEDALS = ["🥇", "🥈", "🥉", ""];

/**
 * ミニゲームの順位とコイン報酬を表示する。
 * コインの加算はホストが済ませているので、ここは表示だけ。
 * 同じ純関数で計算するため、表示と実際の増減は必ず一致する。
 */
export default function MinigameResult() {
  const room = useRoom((s) => s.room);
  const myUid = useRoom((s) => s.myUid);
  const players = selectPlayers(room);

  const game = findMinigame(room?.minigame?.id);
  const ranking = room?.minigame?.ranking ?? [];
  const scores = room?.minigame?.scores;

  // 実際の増減はホストが済ませているので、ここは同じ式で表示するだけ
  const rewards: Record<string, number> = Object.fromEntries(
    ranking.map((uid, index) => [uid, ffaReward(index, false)]),
  );
  const doubled = new Set<string>();

  // 自分がコインをもらえたときだけ鳴らす
  const myGain = myUid !== null ? (rewards[myUid] ?? 0) : 0;
  useEffect(() => {
    if (myGain > 0) playSound("coin");
  }, [myGain]);

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <p className="text-sm text-slate-400">{game?.title ?? "ミニゲーム"}</p>
        <h1 className="text-2xl font-bold">けっか</h1>
      </div>

      <ul className="flex w-full max-w-sm flex-col gap-2">
        {ranking.map((uid, index) => {
          const entry = players.find((player) => player.uid === uid);
          if (!entry) return null;
          const color = PLAYER_COLORS[entry.player.colorIdx];
          const gain = rewards[uid] ?? 0;
          const score = scores?.[uid];
          return (
            <motion.li
              key={uid}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.18, duration: 0.25 }}
              className={`flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 ${
                uid === myUid ? "bg-slate-700 ring-1 ring-sky-500" : "bg-slate-800"
              }`}
            >
              <span className="w-7 shrink-0 text-center text-xl">
                {MEDALS[index] ?? ""}
              </span>
              <span className={`size-4 shrink-0 rounded-full ${color.dot}`} />
              <span className="flex-1 truncate text-base font-medium">
                {entry.player.name}
              </span>
              {typeof score === "number" && (
                <span className="shrink-0 text-sm tabular-nums text-slate-400">
                  {score}
                </span>
              )}
              <span
                className={`w-14 shrink-0 text-right text-base font-bold tabular-nums ${
                  gain > 0 ? "text-amber-300" : "text-slate-500"
                }`}
              >
                {gain > 0 ? `+${gain}` : "±0"}
              </span>
            </motion.li>
          );
        })}
      </ul>

      {doubled.size > 0 && (
        <p className="text-xs text-violet-300">
          ★ミニゲームのマスに とまった人は ほうしゅう2ばい！
        </p>
      )}
      <p className="text-sm text-slate-400">つぎの ターンへ…</p>
    </main>
  );
}
