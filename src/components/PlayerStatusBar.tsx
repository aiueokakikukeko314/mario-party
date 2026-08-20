import { PLAYER_COLORS } from "./PlayerCard";
import type { Player } from "../types";

/** 画面上部に全員のコイン/スターを常時表示する。 */
export default function PlayerStatusBar({
  players,
  currentUid,
}: {
  players: { uid: string; player: Player }[];
  currentUid: string | null;
}) {
  return (
    <ul className="grid shrink-0 grid-cols-2 gap-1 px-2 pt-2 text-xs">
      {players.map(({ uid, player }) => (
        <li
          key={uid}
          className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 ${
            uid === currentUid ? "bg-slate-700 ring-1 ring-sky-400" : "bg-slate-800"
          }`}
        >
          <span
            className={`size-2.5 shrink-0 rounded-full ${
              PLAYER_COLORS[player.colorIdx].dot
            } ${player.connected ? "" : "opacity-30"}`}
          />
          <span className="min-w-0 flex-1 truncate">{player.name}</span>
          <span className="shrink-0 text-amber-300">★{player.stars}</span>
          <span className="shrink-0 text-yellow-200">{player.coins}</span>
        </li>
      ))}
    </ul>
  );
}
