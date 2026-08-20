import { finishTurn } from "../lib/dbGame";
import { selectIsHost, selectPlayers, useRoom } from "../store/useRoom";
import type { Phase } from "../types";

/**
 * Phase 3 以降で実装する画面の仮表示。
 * ミニゲーム系のフェーズでは、ボードの進行を確認できるように
 * ホストだけが「ミニゲームを飛ばして次のターンへ」を押せるようにしてある（仮）。
 */
export default function PhasePlaceholder({ phase }: { phase: Phase }) {
  const room = useRoom((s) => s.room);
  const roomCode = useRoom((s) => s.roomCode);
  const myUid = useRoom((s) => s.myUid);
  const leave = useRoom((s) => s.leave);
  const isHost = selectIsHost(room, myUid);
  const players = selectPlayers(room);

  const isMinigamePhase =
    phase === "minigameIntro" ||
    phase === "minigame" ||
    phase === "minigameResult";

  async function skip(): Promise<void> {
    const first = players[0];
    if (roomCode === null || room === null || !room.board || !first) return;
    await finishTurn(
      roomCode,
      room.board.turn,
      room.meta.maxTurns,
      first.uid,
    );
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-slate-400">現在のフェーズ</p>
      <p className="text-3xl font-bold">{phase}</p>

      {phase === "gameEnd" ? (
        <ul className="w-full max-w-xs text-sm">
          {[...players]
            .sort(
              (a, b) =>
                b.player.stars - a.player.stars ||
                b.player.coins - a.player.coins,
            )
            .map(({ uid, player }, index) => (
              <li
                key={uid}
                className="flex items-center gap-2 border-b border-slate-800 py-2"
              >
                <span className="w-6 text-slate-400">{index + 1}位</span>
                <span className="flex-1 truncate">{player.name}</span>
                <span className="text-amber-300">★{player.stars}</span>
                <span className="text-yellow-200">{player.coins}</span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="max-w-xs text-center text-sm text-slate-400">
          この画面は Phase 3 以降で実装します。
        </p>
      )}

      {isMinigamePhase && isHost && (
        <button
          type="button"
          onClick={() => void skip()}
          className="mt-2 min-h-14 rounded-xl bg-sky-500 px-6 text-base font-bold text-white"
        >
          （仮）ミニゲームを飛ばして次のターンへ
        </button>
      )}

      <button
        type="button"
        onClick={() => void leave()}
        className="mt-2 min-h-14 rounded-xl bg-slate-700 px-8 text-base"
      >
        ホームにもどる
      </button>
    </main>
  );
}
