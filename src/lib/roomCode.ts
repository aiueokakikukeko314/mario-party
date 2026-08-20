/**
 * ルームコード（CLAUDE.md セクション4）。
 * 4 桁の英数字。読み間違えやすい `0` `O` `1` `I` は使わない。
 */

/** 使用する文字。数字 2-9 と、I・O を除いた英大文字の計 32 種。 */
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const ROOM_CODE_LENGTH = 4;

/**
 * ランダムなルームコードを生成する。
 * 32 は 256 の約数なので、256 で割った余りを使っても偏りは出ない。
 */
export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * 入力されたコードを正規化する（小文字→大文字、空白除去）。
 * 使用できない文字は取り除くので、結果が 4 桁に満たなければ不正な入力。
 */
export function normalizeRoomCode(input: string): string {
  return [...input.toUpperCase()]
    .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
    .join("")
    .slice(0, ROOM_CODE_LENGTH);
}

/** 正規化済みのコードとして妥当か。 */
export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH &&
    [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))
  );
}
