import { motion } from "framer-motion";

/** プレイヤーの色（colorIdx 0..3 に対応）。Tailwind のクラスは静的な文字列で持つ。 */
export const PLAYER_COLORS = [
  { dot: "bg-rose-500", name: "あか" },
  { dot: "bg-sky-500", name: "あお" },
  { dot: "bg-emerald-500", name: "みどり" },
  { dot: "bg-amber-400", name: "きいろ" },
] as const;

interface Props {
  name: string;
  colorIdx: 0 | 1 | 2 | 3;
  connected: boolean;
  isHost: boolean;
  isMe: boolean;
}

export default function PlayerCard({
  name,
  colorIdx,
  connected,
  isHost,
  isMe,
}: Props) {
  const color = PLAYER_COLORS[colorIdx];
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-800 px-4 py-3"
    >
      <span
        className={`size-5 shrink-0 rounded-full ${color.dot} ${
          connected ? "" : "opacity-30"
        }`}
        aria-label={color.name}
      />
      <span className="flex-1 truncate text-base font-medium">
        {name}
        {isMe && <span className="ml-1 text-xs text-slate-400">(あなた)</span>}
      </span>
      {isHost && (
        <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-1 text-xs text-amber-300">
          ホスト
        </span>
      )}
      {!connected && (
        <span className="shrink-0 text-xs text-slate-500">切断中</span>
      )}
    </motion.li>
  );
}
