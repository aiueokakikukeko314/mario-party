import { motion } from "framer-motion";
import { findItem } from "../board/items/registry";
import { buyBlockReason, stockDefs } from "../logic/shop";
import { inventoryList } from "../logic/items";
import { PLAYER_COLORS } from "./PlayerCard";
import { STAR_COST } from "../constants";
import type { PendingDecision, Player } from "../types";

/**
 * 選択待ちの UI をまとめて受け持つ。
 * 本人だけがボタンを押せる。他の人には待機表示を出す。
 */

interface Props {
  decision: PendingDecision;
  isMine: boolean;
  currentName: string;
  me: Player | undefined;
  /** 相手を選ぶアイテム用 */
  others: { uid: string; player: Player }[];
  onAnswer: (payload: unknown) => void;
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

export default function DecisionPanel({
  decision,
  isMine,
  currentName,
  me,
  others,
  onAnswer,
}: Props) {
  if (!isMine) {
    return (
      <Waiting>
        {currentName} が {labelOf(decision.type)} を えらんでいます…
      </Waiting>
    );
  }

  switch (decision.type) {
    case "branch": {
      const options = (record(decision.options)["options"] as number[]) ?? [];
      return (
        <Panel title="どっちへ すすむ？">
          <div className="flex gap-2">
            {options.map((to, index) => (
              <button
                key={to}
                type="button"
                onClick={() => onAnswer({ to })}
                className="min-h-14 flex-1 rounded-xl bg-sky-500 text-base font-bold text-white"
              >
                {index === 0 ? "◀ ほんどう" : "ちかみち ▶"}
              </button>
            ))}
          </div>
        </Panel>
      );
    }

    case "starPurchase": {
      const affordable = record(decision.options)["affordable"] === true;
      if (!affordable) {
        return (
          <Panel title="スターの ばしょ">
            <p className="text-center text-sm text-slate-300">
              コインが たりません（{STAR_COST} まい ひつよう）
            </p>
          </Panel>
        );
      }
      return (
        <Panel title={`スターを ${STAR_COST} コインで こうかんする？`}>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAnswer({ buy: true })}
              className="min-h-14 flex-1 rounded-xl bg-amber-400 text-base font-bold text-amber-950"
            >
              こうかんする
            </button>
            <button
              type="button"
              onClick={() => onAnswer({ buy: false })}
              className="min-h-14 flex-1 rounded-xl bg-slate-700 text-base font-bold"
            >
              やめる
            </button>
          </div>
        </Panel>
      );
    }

    case "shop": {
      const stock = stockDefs(
        (record(decision.options)["stock"] as string[]) ?? [],
      );
      return (
        <Panel title="ショップ">
          <div className="flex flex-col gap-2">
            {stock.map((item) => {
              const blocked = buyBlockReason(item.id, me?.coins ?? 0, me?.inventory);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={blocked !== null}
                  onClick={() => onAnswer({ itemId: item.id })}
                  className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-700 px-3 py-2 text-left disabled:opacity-40"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {item.name}
                    </span>
                    <span className="block truncate text-xs text-slate-300">
                      {blocked === "coins"
                        ? "コインが たりない"
                        : blocked === "full"
                          ? "もちものが いっぱい"
                          : item.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-amber-300">
                    {item.price}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onAnswer({ leave: true })}
              className="min-h-14 rounded-xl bg-slate-800 text-base"
            >
              出る
            </button>
          </div>
        </Panel>
      );
    }

    case "itemChoice": {
      const items = inventoryList(me?.inventory);
      return (
        <Panel title="アイテムを つかう？">
          <div className="flex flex-col gap-2">
            {items.map(({ slot, item }) => (
              <button
                key={slot}
                type="button"
                onClick={() => onAnswer({ slot })}
                className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-700 px-3 text-left"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {item.name}
                  </span>
                  <span className="block truncate text-xs text-slate-300">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => onAnswer({ skip: true })}
              className="min-h-14 rounded-xl bg-slate-800 text-base"
            >
              つかわない
            </button>
          </div>
        </Panel>
      );
    }

    case "itemTarget": {
      const itemId = record(decision.options)["itemId"];
      const item = findItem(typeof itemId === "string" ? itemId : null);
      return (
        <Panel title={`${item?.name ?? "アイテム"} を だれに つかう？`}>
          <div className="flex flex-col gap-2">
            {others.map(({ uid, player }) => (
              <button
                key={uid}
                type="button"
                onClick={() => onAnswer({ target: uid })}
                className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-700 px-3 text-left"
              >
                <span
                  className={`size-4 shrink-0 rounded-full ${PLAYER_COLORS[player.colorIdx].dot}`}
                />
                <span className="flex-1 truncate text-base">{player.name}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  ★{player.stars} ・ {player.coins}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      );
    }

    case "eventChoice": {
      if (record(decision.options)["kind"] !== "reroll") return null;
      const total = record(decision.options)["total"];
      return (
        <Panel title={`${String(total)} が出ました。ふりなおす？`}>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAnswer({ reroll: false })}
              className="min-h-14 flex-1 rounded-xl bg-sky-500 text-base font-bold text-white"
            >
              このまま すすむ
            </button>
            <button
              type="button"
              onClick={() => onAnswer({ reroll: true })}
              className="min-h-14 flex-1 rounded-xl bg-amber-400 text-base font-bold text-amber-950"
            >
              ふりなおす
            </button>
          </div>
        </Panel>
      );
    }

    default:
      return null;
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-slate-800/95 p-3 ring-1 ring-slate-600"
    >
      <p className="mb-2 text-center text-sm text-slate-300">{title}</p>
      {children}
    </motion.div>
  );
}

function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-slate-800 py-3 text-center text-sm text-slate-300">
      {children}
    </p>
  );
}

function labelOf(type: PendingDecision["type"]): string {
  switch (type) {
    case "branch": return "ルート";
    case "starPurchase": return "スター";
    case "shop": return "ショップ";
    case "itemChoice": return "アイテム";
    case "itemTarget": return "つかう相手";
    default: return "つぎの こうどう";
  }
}

export { findItem };
