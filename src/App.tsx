import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { authReady } from "./lib/firebase";
import { subscribeConnected } from "./lib/db";
import { startTimeSync } from "./lib/time";
import { useRoom } from "./store/useRoom";
import Home from "./screens/Home";
import Lobby from "./screens/Lobby";
import Minigame from "./screens/Minigame";
import MinigameResult from "./screens/MinigameResult";
import GameEnd from "./screens/GameEnd";
import Board from "./screens/Board";
import PhasePlaceholder from "./screens/PhasePlaceholder";
import { useHost } from "./hooks/useHost";
import { useHostHandover } from "./hooks/useHostHandover";
import { useWakeLock } from "./hooks/useWakeLock";
import { initSound, isMuted, setMuted } from "./lib/sound";

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
  const restoring = useRoom((s) => s.restoring);
  const leave = useRoom((s) => s.leave);

  const [authError, setAuthError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);

  const [muted, setMutedState] = useState(isMuted);

  // ホスト端末だけがゲームロジックを回す（内部で isHost をガードしている）
  useHost();
  // ホストが落ちたら、次の人が引き継ぐ（ホスト以外で動く）
  useHostHandover();
  // ルームに入っている間は画面を消さない
  useWakeLock(roomCode !== null);

  // iOS は最初のタップより前に音を鳴らせないので、そこで初期化する
  useEffect(() => {
    const onFirstTap = (): void => {
      initSound();
      window.removeEventListener("pointerdown", onFirstTap);
    };
    window.addEventListener("pointerdown", onFirstTap);
    return () => window.removeEventListener("pointerdown", onFirstTap);
  }, []);

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
    <div className="relative flex h-full flex-col">
      {!connected && (
        <p className="shrink-0 bg-amber-500/90 py-1 text-center text-xs text-black">
          接続が切れています…
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey()}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 音のオンオフ。ルームに入っている間だけ出す */}
      {roomCode !== null && (
        <button
          type="button"
          aria-label={muted ? "音を出す" : "音を消す"}
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedState(next);
          }}
          className="absolute right-2 top-2 z-20 size-11 rounded-full bg-slate-800/70 text-lg"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}
    </div>
  );

  /** 遷移アニメーションの単位。同じ画面のままなら再生しない */
  function screenKey(): string {
    if (authError !== null) return "error";
    if (myUid === null) return "boot";
    if (roomCode === null) return restoring ? "restoring" : "home";
    if (!roomLoaded) return "loading";
    if (room === null) return "gone";
    // イントロとプレイは同じ画面なので、まとめて1つの key にする
    const phase = room.meta.phase;
    return phase === "minigameIntro" || phase === "minigame"
      ? "minigame"
      : phase;
  }

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
      // リロード直後は、前のルームに戻れるか確かめてからホームを出す
      if (restoring) return <Centered title="まえのルームに もどっています…" />;
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
    // イントロとプレイは同じコンポーネントで受ける。
    // 差し替えるとアンマウントされ、連打数などのローカル状態が消えるため。
    if (
      room.meta.phase === "minigameIntro" ||
      room.meta.phase === "minigame"
    ) {
      return <Minigame />;
    }
    if (room.meta.phase === "minigameResult") {
      return <MinigameResult />;
    }
    if (room.meta.phase === "gameEnd") {
      return <GameEnd />;
    }
    if (room.meta.phase === "board") {
      return <Board />;
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
