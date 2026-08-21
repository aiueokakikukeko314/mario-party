/**
 * ボードをグラフとして表す。リング1本ではなく分岐を持てる。
 * 座標は見た目だけの情報で、ゲームロジックには影響しない。
 */

export type NodeType =
  | "start"
  | "plus"
  | "minus"
  | "lucky"
  | "unlucky"
  | "event"
  | "item"
  | "warp"
  | "empty";

/** 通過・着地したときに反応する施設。 */
export type Facility = "star" | "shop" | "gate";

export interface BoardNode {
  id: number;
  x: number;
  y: number;
  z?: number;
  type: NodeType;
  /** 進める先。1つなら自動、2つ以上なら本人が選ぶ。 */
  next: number[];
  facility?: Facility;
  eventId?: string;
  /** warp マスの飛び先 */
  warpTo?: number;
}

/**
 * 開け閉めできるルート。boardFlags の値で通れるかが変わる。
 * flag が false のときだけ閉じる（未設定なら開いている扱い）。
 */
export interface BoardGate {
  from: number;
  to: number;
  flag: string;
}

export interface BoardDef {
  id: string;
  name: string;
  startNodeId: number;
  /** スターが置かれうるノード */
  starCandidates: number[];
  nodes: readonly BoardNode[];
  gates?: readonly BoardGate[];
}
