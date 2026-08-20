import { motion } from "framer-motion";

/** サイコロの出目表示。出目を決めるのはホストだけ（CLAUDE.md セクション3）。 */
export default function Dice({
  value,
  rolling,
}: {
  value: number | null;
  rolling: boolean;
}) {
  return (
    <motion.div
      animate={rolling ? { rotate: [0, -12, 12, -8, 0] } : { rotate: 0 }}
      transition={
        rolling
          ? { duration: 0.45, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
      className="flex size-14 items-center justify-center rounded-xl bg-white text-3xl font-bold text-slate-900 shadow-lg"
    >
      {value ?? "?"}
    </motion.div>
  );
}
