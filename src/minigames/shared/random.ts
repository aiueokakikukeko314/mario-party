/**
 * ミニゲーム用の決定的な擬似乱数。
 *
 * 同じ step からは必ず同じ値が出るので、
 * remainingMs（＝endAt からの逆算なので全端末でほぼ一致）を step の元にすれば、
 * **全員の画面に同じ配置・同じ順番**が出る。
 * 通信を増やさずに条件をそろえられる（CLAUDE.md セクション7 のローカル完結を維持）。
 */

/** step と salt から 32bit の値を作る。 */
export function hashStep(step: number, salt: number): number {
  let x = ((step + 1) * 2654435761 + salt * 40503) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 2246822519) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return x >>> 0;
}

/** 0 以上 max 未満の整数を決定的に返す。 */
export function pickFrom(step: number, salt: number, max: number): number {
  if (max <= 0) return 0;
  return hashStep(step, salt) % max;
}
