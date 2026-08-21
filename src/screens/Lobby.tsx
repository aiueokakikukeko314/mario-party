import PlayerCard from "../components/PlayerCard";
import { selectIsHost, selectPlayers, useRoom } from "../store/useRoom";
import { MAX_PLAYERS, MIN_PLAYERS, TURN_OPTIONS } from "../constants";
import { canStartGame } from "../logic/lobby";
import { updateConfig } from "../lib/db";

/**
 * ロビー画面。参加者一覧と、ホストだけが触れるゲーム設定。
 * 設定はゲーム開始後は変更しない。
 */
export default function Lobby() {
  const roomCode = useRoom((s) => s.roomCode);
  const room = useRoom((s) => s.room);
  const myUid = useRoom((s) => s.myUid);
  const busy = useRoom((s) => s.busy);
  const leave = useRoom((s) => s.leave);
  const start = useRoom((s) => s.start);

  const players = selectPlayers(room);
  const isHost = selectIsHost(room, myUid);
  const config = room?.config;
  const enoughPlayers = room?.players ? canStartGame(room.players) : false;
  const allConnected = players.every((entry) => entry.player.connected);
  const canStart = enoughPlayers && allConnected;

  const change = (patch: Parameters<typeof updateConfig>[1]): void => {
    if (!isHost || roomCode === null) return;
    void updateConfig(roomCode, patch);
  };

  return (
    <main className="flex h-full flex-col gap-4 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <section className="flex flex-col items-center gap-1">
        <p className="text-sm text-slate-400">ルームコード</p>
        <p className="text-5xl font-bold tracking-[0.2em]">{roomCode}</p>
        <p className="mt-1 text-xs text-slate-400">
          このコードを みんなに教えてください
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm text-slate-400">
          参加者 {players.length} / {MAX_PLAYERS}
        </p>
        <ul className="flex flex-col gap-2">
          {players.map(({ uid, player }) => (
            <PlayerCard
              key={uid}
              name={player.name}
              colorIdx={player.colorIdx}
              connected={player.connected}
              isHost={room?.meta.hostId === uid}
              isMe={uid === myUid}
            />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-slate-800 p-4">
        <p className="text-sm text-slate-400">
          ゲーム設定{isHost ? "" : "（ホストが決めます）"}
        </p>

        <Row label="ターン数">
          <div className="flex gap-2">
            {TURN_OPTIONS.map((turns) => (
              <button
                key={turns}
                type="button"
                disabled={!isHost}
                onClick={() => change({ maxTurns: turns })}
                className={`min-h-11 flex-1 rounded-lg text-sm font-bold disabled:opacity-60 ${
                  config?.maxTurns === turns ? "bg-sky-500 text-white" : "bg-slate-700"
                }`}
              >
                {turns}
              </button>
            ))}
          </div>
        </Row>

        <Toggle
          label="アイテムを使う"
          value={config?.itemsEnabled !== false}
          disabled={!isHost}
          onChange={(value) => change({ itemsEnabled: value })}
        />
        <Toggle
          label="さいごに ボーナススター"
          value={config?.bonusAwardsEnabled !== false}
          disabled={!isHost}
          onChange={(value) => change({ bonusAwardsEnabled: value })}
        />
      </section>

      <div className="mt-auto flex flex-col gap-3">
        {isHost ? (
          <button
            type="button"
            disabled={!canStart || busy}
            onClick={() => void start()}
            className="min-h-14 rounded-xl bg-sky-500 text-base font-bold text-white disabled:opacity-40"
          >
            {!enoughPlayers
              ? `あと ${MIN_PLAYERS - players.length} 人 待っています`
              : !allConnected
                ? "せつだん中の人が います"
                : "ゲームを開始"}
          </button>
        ) : (
          <p className="min-h-14 content-center rounded-xl bg-slate-800 text-center text-sm text-slate-400">
            ホストが開始するのを待っています…
          </p>
        )}
        <button
          type="button"
          onClick={() => void leave()}
          className="min-h-14 rounded-xl bg-slate-700 text-base"
        >
          {isHost ? "ルームを解散する" : "退出する"}
        </button>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="flex min-h-11 items-center justify-between rounded-lg bg-slate-700 px-3 text-sm disabled:opacity-60"
    >
      <span>{label}</span>
      <span className={value ? "text-emerald-400" : "text-slate-500"}>
        {value ? "ON" : "OFF"}
      </span>
    </button>
  );
}
