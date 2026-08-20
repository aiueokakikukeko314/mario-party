import { useEffect, useState } from "react";
import { authReady } from "./lib/firebase";
import { subscribeConnected } from "./lib/db";
import { startTimeSync } from "./lib/time";
import { useRoom } from "./store/useRoom";
import Home from "./screens/Home";
import Lobby from "./screens/Lobby";
import PhasePlaceholder from "./screens/PhasePlaceholder";

/**
 * 画面の出し分けだけを行う（CLAUDE.md セクション5）。
 * ルームに入ったあとは meta.phase にのみ従う。
 */
export default function App() {
  const myUid = useRoom((s) => s.myUid);
  const setMyUid = useRoom((s) => s.setMyUid);
  const roomCode = useRoom((s) => s.roomCode);
  const room = useRoom((s) => s.room);
  const roomLoaded = useRoom((s) => s.roomLoaded);
  const leave = useRoom((s) => s.leave);

  const [authError, setAuthError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    startTimeSync();
  }, []);

  useEffect(() => {
    let alive = true;
    authReady.then(
      (uid) => {
        if (alive) setMyUid(uid);
      },
      (error: unknown) => {
        if (alive) {
          setAuthError(error instanceof Error ? error.message : String(error));
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [setMyUid]);

  useEffect(() => subscribeConnected(setConnected), []);

  return (
    // バナーは overlay させず、フレックスで内容を押し下げる
    <div className="flex h-full flex-col">
      {!connected && (
        <p className="shrink-0 bg-amber-500/90 py-1 text-center text-xs text-black">
          接続が切れています…
        </p>
      )}
      <div className="min-h-0 flex-1">{renderScreen()}</div>
    </div>
  );

  function renderScreen() {
    if (authError !== null) {
      return (
        <Centered title="サインインに失敗しました">
          <p className="text-sm text-red-300">{authError}</p>
        </Centered>
      );
    }
    if (myUid === null) {
      return <Centered title="準備しています…" />;
    }
    if (roomCode === null) {
      return <Home />;
    }
    if (!roomLoaded) {
      return <Centered title="ルームに接続しています…" />;
    }
    if (room === null) {
      return (
        <Centered title="ルームが解散されました">
          <button
            type="button"
            onClick={() => void leave()}
            className="min-h-14 rounded-xl bg-slate-700 px-8 text-base"
          >
            ホームにもどる
          </button>
        </Centered>
      );
    }
    if (room.meta.phase === "lobby") {
      return <Lobby />;
    }
    return <PhasePlaceholder phase={room.meta.phase} />;
  }
}

function Centered({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <p className="text-lg font-bold">{title}</p>
      {children}
    </main>
  );
}
