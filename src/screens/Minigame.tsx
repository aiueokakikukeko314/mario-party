import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useServerNow } from "../hooks/useServerTime";
import { findMinigame } from "../minigames/registry";
import { sendInput } from "../lib/dbGame";
import { useRoom } from "../store/useRoom";

/**
 * ミニゲームのルール説明・カウントダウン・プレイをまとめて受け持つ画面。
 *
 * `minigameIntro` と `minigame` の両フェーズでこの同じコンポーネントを描画する。
 * 理由: 途中で別コンポーネントに差し替えるとアンマウントされ、
 * 連打数などのローカル状態が消えてしまう。
 * 開始・終了の判定は phase の到着時刻ではなく **startAt / endAt の絶対時刻**で
 * 行うので、通信が遅れた端末でも開始タイミングはズレない（CLAUDE.md セクション6）。
 */
export default function Minigame() {
  const room = useRoom((s) => s.room);
  const roomCode = useRoom((s) => s.roomCode);
  const myUid = useRoom((s) => s.myUid);
  const now = useServerNow();

  const game = findMinigame(room?.minigame?.id);
  const startAt = room?.minigame?.startAt ?? null;
  const endAt = room?.minigame?.endAt ?? null;

  // 最後に報告されたスコア。null は「一度も報告が無い」
  const scoreRef = useRef<number | null>(null);
  const sentRef = useRef(false);
  const [sent, setSent] = useState(false);

  const onScore = useCallback((score: number) => {
    scoreRef.current = score;
  }, []);

  const finished = endAt !== null && now >= endAt;

  // 終了時刻を過ぎたら最終スコアを1回だけ送る。
  // minigame ノードはホストしか書けないので inputs 経由で渡す（セクション9）
  useEffect(() => {
    if (!finished || sentRef.current) return;
    if (roomCode === null || myUid === null) return;
    sentRef.current = true;
    setSent(true);
    void sendInput(roomCode, myUid, "score", scoreRef.current ?? 0);
  }, [finished, roomCode, myUid]);

  if (!game || startAt === null || endAt === null) {
    return <Centered>ミニゲームを えらんでいます…</Centered>;
  }

  // --- 開始前: ルール説明とカウントダウン ---
  if (now < startAt) {
    const remain = Math.ceil((startAt - now) / 1000);
    return (
      <main className="flex h-full flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-3xl font-bold">{game.title}</h1>
        <p className="max-w-xs text-center text-base leading-relaxed text-slate-300">
          {game.description}
        </p>
        <motion.p
          key={remain}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-8xl font-bold tabular-nums text-sky-400"
        >
          {remain}
        </motion.p>
        <p className="text-sm text-slate-400">よーい…</p>
      </main>
    );
  }

  // --- 終了後: ホストの集計待ち ---
  if (finished) {
    return (
      <Centered>
        <p className="text-lg font-bold">おわり！</p>
        <p className="text-sm text-slate-400">
          {sent ? "けっかを あつめています…" : "スコアを おくっています…"}
        </p>
      </Centered>
    );
  }

  // --- プレイ中 ---
  const remainingMs = Math.max(0, endAt - now);
  return (
    <main className="flex h-full flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-baseline justify-between px-2">
        <span className="text-sm text-slate-400">{game.title}</span>
        <span className="text-2xl font-bold tabular-nums">
          {(remainingMs / 1000).toFixed(1)}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <game.Component remainingMs={remainingMs} onScore={onScore} />
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2 p-6">
      {children}
    </main>
  );
}
