import { BOARD_SIZE } from "../logic/board";

/**
 * 24マスを3D空間のどこに置くかの定義（見た目だけ。ゲームロジックとは無関係）。
 *
 * 真円だと単調なので、半径と高さを 3 周期でうねらせて「クネクネしたリング」にする。
 * すべて定数から決まるので、どの端末でも同じ配置になる。
 */

export interface TilePos {
  x: number;
  /** 画面の上下方向。負が上。 */
  y: number;
  z: number;
}

/** リングの基準半径(px)。半径*(1+WOBBLE)*2 + TILE_SIZE がスマホ幅(390px)に収まる値。 */
const RADIUS = 138;
/** 半径のうねり具合 */
const WOBBLE = 0.2;
/** 高さのうねり幅(px) */
const RISE = 22;
/** うねりの周期数 */
const WAVES = 3;

export const TILE_SIZE = 36;

export const TILE_POSITIONS: readonly TilePos[] = Array.from(
  { length: BOARD_SIZE },
  (_, i) => {
    const t = (i / BOARD_SIZE) * Math.PI * 2;
    const radius = RADIUS * (1 + WOBBLE * Math.cos(WAVES * t));
    return {
      x: radius * Math.cos(t),
      y: -RISE * Math.sin(WAVES * t),
      z: radius * Math.sin(t),
    };
  },
);

/** 指定マスの位置。範囲外はリング状に丸める。 */
export function tilePos(pos: number): TilePos {
  const index = ((pos % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  return TILE_POSITIONS[index] ?? { x: 0, y: 0, z: 0 };
}
