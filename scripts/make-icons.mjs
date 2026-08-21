/**
 * PWA 用のアイコン PNG を生成する。
 * 画像ライブラリを足したくないので、zlib だけで PNG を組み立てている。
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA のピクセル配列を PNG にする */
function toPng(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // フィルタなし
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 5角の星の頂点を作る（外側と内側を交互に10個） */
function starPoints(radius) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.42;
    points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return points;
}

/** 多角形の内外判定（交差数を数える） */
function inPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function render(size, padding) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const star = starPoints(size * 0.34);
  const boxRadius = size * 0.22; // 角丸
  const inner = size / 2 - padding;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - center;
      const dy = y - center;

      // 角丸四角の内側か
      const ax = Math.abs(dx) - (inner - boxRadius);
      const ay = Math.abs(dy) - (inner - boxRadius);
      const outside =
        ax > 0 && ay > 0
          ? Math.hypot(ax, ay) > boxRadius
          : Math.abs(dx) > inner || Math.abs(dy) > inner;

      if (outside) {
        pixels[i + 3] = 0; // 透明
        continue;
      }

      // 背景は上から下へのグラデーション（濃紺→藍）
      const t = y / size;
      pixels[i] = Math.round(15 + t * 20);
      pixels[i + 1] = Math.round(23 + t * 40);
      pixels[i + 2] = Math.round(42 + t * 90);
      pixels[i + 3] = 255;

      // 中央に星
      if (inPolygon(dx, dy, star)) {
        pixels[i] = 252;
        pixels[i + 1] = 211;
        pixels[i + 2] = 77;
      }
    }
  }
  return toPng(size, pixels);
}

mkdirSync("public/icons", { recursive: true });
const targets = [
  ["icon-192.png", 192, 6],
  ["icon-512.png", 512, 16],
  // maskable はセーフゾーンを確保するため余白を多めに取る
  ["icon-maskable-512.png", 512, 64],
  ["apple-touch-icon.png", 180, 0],
];
for (const [name, size, padding] of targets) {
  const png = render(size, padding);
  writeFileSync(`public/icons/${name}`, png);
  console.log(`  ${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
