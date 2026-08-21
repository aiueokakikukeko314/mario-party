import { rankPlayers } from "../logic/result";
import { PLAYER_COLORS } from "./PlayerCard";
import type { Player } from "../types";

/**
 * 画面上部に常に出す全員の状況。
 * 順位はスター→コインの順で決める（CLAUDE.md セクション8）。
 */
export default function PlayerStatusBar({
  players,
  currentUid,
}: {
  players: { uid: string; player: Player }[];
  currentUid: string | null;
}) {
  const byUid = Object.fromEntries(
    players.map((entry) => [entry.uid, entry.player]),
  );
  const ranked = rankPlayers(byUid);
  const rankOf = new Map(ranked.map((entry) => [entry.uid, entry.rank]));

  return (
    <div className="grid shrink-0 grid-cols-2 gap-1 py-2 pl-2 pr-12">
      {players.map(({ uid, player }) => {
        const color = PLAYER_COLORS[player.colorIdx];
        const active = uid === currentUid;
        return (
          <div
            key={uid}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs ${
              active ? "bg-slate-700 ring-2 ring-sky-400" : "bg-slate-800"
            }`}
          >
            <span className="w-4 shrink-0 text-center font-bold text-slate-400">
              {rankOf.get(uid) ?? "-"}
            </span>
            <span
              className={`size-3 shrink-0 rounded-full ${color.dot} ${
                player.connected ? "" : "opacity-30"
              }`}
            />
            <span className="min-w-0 flex-1 truncate">{player.name}</span>
            {!player.connected && <span className="shrink-0">📵</span>}
            <span className="shrink-0 tabular-nums text-amber-300">
              ★{player.stars}
            </span>
            <span className="w-7 shrink-0 text-right tabular-nums">
              {player.coins}
            </span>
          </div>
        );
      })}
    </div>
  );
}
