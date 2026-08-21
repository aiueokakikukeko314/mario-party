/**
 * ボード固有イベント。event マスに止まると起きる。
 * 効果は純粋なデータとして返し、適用はホストが行う。
 */

export interface BoardEventEffect {
  text: string;
  /** boardFlags をこの値で上書きする */
  flags?: Record<string, boolean | number | string>;
  /** 全員のコインをシャッフルして配り直す */
  shuffleCoins?: boolean;
  /** 全員を数マス進める */
  nudgeAll?: number;
}

export interface BoardEventDef {
  id: string;
  name: string;
  /** random は 0以上1未満 */
  run: (random: number, flags: Record<string, boolean | number | string>) =>
    BoardEventEffect;
}

export const BOARD_EVENTS: readonly BoardEventDef[] = [
  {
    id: "bridge-shift",
    name: "はしのむき",
    run: (_random, flags) => {
      // 近道2（16番からの分かれ道）を開け閉めする
      const open = flags["bridgeOpen"] === false;
      return {
        text: open ? "ちかみちの はしが かかった！" : "ちかみちの はしが はずれた…",
        flags: { bridgeOpen: open },
      };
    },
  },
  {
    id: "coin-shuffle",
    name: "コインシャッフル",
    run: () => ({
      text: "みんなの コインが シャッフルされた！",
      shuffleCoins: true,
    }),
  },
];

export function findBoardEvent(id: string | null | undefined) {
  if (!id) return null;
  return BOARD_EVENTS.find((event) => event.id === id) ?? null;
}
