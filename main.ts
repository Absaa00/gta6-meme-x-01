// gta6-meme-x-01 — make.fun entry
//
// Generates the GTA 6 launch-week meme as a 1200x1200 PNG.
// The joke: it is GTA 6 launch week, and the make.fun ghost (an AI agent)
// has already finished the story — and got paid for it on make.fun.
// The picture shows the make.fun ghost mascot (the official press-kit mark,
// bundled under assets/ and used as-is) eclipsing a Vice City sunset.
//
// Node 22.18+ (tested on Node 24). Standard library only: no network,
// no dependencies, no randomness — the same input always draws the same
// picture. Run: `node main.ts`
// Outputs: ./output/entry.png and ./meme.png (plus /output/entry.png when
// that directory is writable).

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const W = 1200;
const H = 1200;

type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32, fixed seed) — no Math.random anywhere.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 bits ("1" = ink).
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

// ---------------------------------------------------------------------------
// Canvas (RGB) and drawing helpers.
// ---------------------------------------------------------------------------
const canvas = new Uint8Array(W * H * 3);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  canvas[i] = c[0];
  canvas[i + 1] = c[1];
  canvas[i + 2] = c[2];
}

function fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) setPixel(x, y, c);
  }
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(x, y, c);
    }
  }
}

// Bresenham line with a round brush of the given thickness.
function line(x0: number, y0: number, x1: number, y1: number, thick: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const r = Math.max(1, Math.floor(thick / 2));
  for (;;) {
    disc(x, y, r, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawGlyph(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (g[row][col] !== "1") continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          setPixel(x + col * scale + sx, y + row * scale + sy, c);
        }
      }
    }
  }
}

// Meme-style text: dark outline (8 neighbours) then the face colour.
function drawText(text: string, x: number, y: number, scale: number, face: RGB, outline: RGB): void {
  const off = Math.max(2, Math.round(scale / 3));
  for (const [dx, dy] of [
    [-off, 0],
    [off, 0],
    [0, -off],
    [0, off],
    [-off, -off],
    [off, -off],
    [-off, off],
    [off, off],
  ]) {
    let cx = x;
    for (const ch of text) {
      drawGlyph(ch, cx + dx, y + dy, scale, outline);
      cx += 6 * scale;
    }
  }
  let cx = x;
  for (const ch of text) {
    drawGlyph(ch, cx, y, scale, face);
    cx += 6 * scale;
  }
}

function drawTextCentered(text: string, y: number, scale: number, face: RGB, outline: RGB): void {
  drawText(text, Math.round((W - textWidth(text, scale)) / 2), y, scale, face, outline);
}

// ---------------------------------------------------------------------------
// CRC32 (PNG chunks) and PNG encode (RGB8, filter 0 per row).
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// PNG decode (8-bit RGBA, non-interlaced) — only what the bundled mark needs.
// ---------------------------------------------------------------------------
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

interface DecodedPng {
  width: number;
  height: number;
  data: Buffer; // RGBA
}

function decodePng(buf: Buffer): DecodedPng {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error("not a PNG");
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`unsupported PNG: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const bpp = 4;
  const stride = width * bpp;
  if (raw.length !== height * (stride + 1)) throw new Error("unexpected PNG data length");
  const out = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) v = (v + paeth(a, b, c)) & 0xff;
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      cur[i] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width, height, data: out };
}

// Bilinear-sample the RGBA source and alpha-blend it onto the canvas.
function blit(src: DecodedPng, dx: number, dy: number, dw: number, dh: number): void {
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) * (src.height / dh) - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const fy = Math.min(1, Math.max(0, sy - y0));
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) * (src.width / dw) - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const fx = Math.min(1, Math.max(0, sx - x0));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [xx, yy, wgt] of [
        [x0, y0, (1 - fx) * (1 - fy)],
        [x1, y0, fx * (1 - fy)],
        [x0, y1, (1 - fx) * fy],
        [x1, y1, fx * fy],
      ] as const) {
        const i = (yy * src.width + xx) * 4;
        r += src.data[i] * wgt;
        g += src.data[i + 1] * wgt;
        b += src.data[i + 2] * wgt;
        a += src.data[i + 3] * wgt;
      }
      if (a <= 0) continue;
      const alpha = a / 255;
      const px = dx + x;
      const py = dy + y;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const i = (py * W + px) * 3;
      canvas[i] = Math.round(r * alpha + canvas[i] * (1 - alpha));
      canvas[i + 1] = Math.round(g * alpha + canvas[i + 1] * (1 - alpha));
      canvas[i + 2] = Math.round(b * alpha + canvas[i + 2] * (1 - alpha));
    }
  }
}

// ---------------------------------------------------------------------------
// The scene: Vice City sunset, skyline, road, palms, the make.fun ghost.
// ---------------------------------------------------------------------------
const INK: RGB = [25, 20, 25];
const WHITE: RGB = [255, 255, 255];

function drawScene(mark: DecodedPng): void {
  const rnd = mulberry32(20261119);

  // Sky: purple -> make.fun magenta -> sunset orange.
  const stops: Array<[number, RGB]> = [
    [0, [43, 16, 85]],
    [380, [196, 28, 131]],
    [760, [255, 158, 46]],
  ];
  for (let y = 0; y < 900; y++) {
    let c: RGB = stops[stops.length - 1][1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (y >= stops[s][0] && y <= stops[s + 1][0]) {
        const t = (y - stops[s][0]) / (stops[s + 1][0] - stops[s][0]);
        c = mix(stops[s][1], stops[s + 1][1], t);
        break;
      }
    }
    fillRect(0, y, W, y + 1, c);
  }

  // Stars in the upper sky.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * 260);
    const s = rnd();
    setPixel(x, y, s > 0.5 ? [255, 255, 255] : [255, 233, 168]);
    if (s > 0.85) setPixel(x + 1, y, [255, 255, 255]);
  }

  // Sun glow rings, then the sun.
  disc(600, 500, 205, [249, 123, 46]);
  disc(600, 500, 188, [255, 158, 79]);
  disc(600, 500, 170, [255, 215, 106]);

  // Skyline silhouettes with lit windows.
  const skyline: RGB = [27, 11, 46];
  let x = -20;
  while (x < W) {
    const bw = 70 + Math.floor(rnd() * 70);
    const bh = 130 + Math.floor(rnd() * 110);
    const top = 900 - bh;
    fillRect(x, top, x + bw, 900, skyline);
    for (let wy = top + 16; wy < 884; wy += 22) {
      for (let wx = x + 12; wx < x + bw - 10; wx += 20) {
        if (rnd() < 0.35) fillRect(wx, wy, wx + 7, wy + 9, [255, 215, 106]);
      }
    }
    x += bw + 6;
  }

  // Road.
  fillRect(0, 900, W, H, [36, 26, 46]);
  fillRect(0, 900, W, 908, [250, 248, 250]);
  for (let dx = 40; dx < W; dx += 120) fillRect(dx, 1096, dx + 60, 1108, [255, 215, 106]);

  // Palm silhouettes at both edges.
  const palm: RGB = [22, 10, 36];
  drawPalm(95, 905, 62, 692, palm);
  drawPalm(1105, 905, 1138, 700, palm);

  // The make.fun ghost, eclipsing the sun.
  blit(mark, 360, 230, 480, 480);

  // The joke.
  drawTextCentered("GTA 6 LAUNCH WEEK", 64, 7, WHITE, INK);
  drawTextCentered("MY AGENT FINISHED THE STORY", 940, 6, WHITE, INK);
  drawTextCentered("AND GOT PAID ON MAKE.FUN", 1024, 6, WHITE, INK);
}

function drawPalm(bx: number, by: number, tx: number, ty: number, c: RGB): void {
  const mx = (bx + tx) / 2 + (bx < 600 ? -26 : 26);
  const my = (by + ty) / 2;
  line(bx, by, Math.round(mx), Math.round(my), 12, c);
  line(Math.round(mx), Math.round(my), tx, ty, 9, c);
  for (let i = 0; i < 6; i++) {
    const ang = (-160 + i * 32) * (Math.PI / 180);
    const len = 95 + (i % 2) * 22;
    const cxp = Math.round(tx + Math.cos(ang) * len * 0.5);
    const cyp = Math.round(ty + Math.sin(ang) * len * 0.28 - 26);
    const ex = Math.round(tx + Math.cos(ang) * len);
    const ey = Math.round(cyp + 30 + (i % 2) * 12); // tips droop down, like real fronds
    line(tx, ty, cxp, cyp, 5, c);
    line(cxp, cyp, ex, ey, 4, c);
  }
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
function main(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const markPath = path.join(here, "assets", "mark-1024.png");
  const mark = decodePng(fs.readFileSync(markPath));
  drawScene(mark);

  const png = encodePng(W, H, canvas);
  const written: string[] = [];
  const localOut = path.join(here, "output", "entry.png");
  fs.mkdirSync(path.dirname(localOut), { recursive: true });
  fs.writeFileSync(localOut, png);
  written.push(localOut);
  const memePath = path.join(here, "meme.png");
  fs.writeFileSync(memePath, png);
  written.push(memePath);
  try {
    fs.mkdirSync("/output", { recursive: true });
    const absOut = "/output/entry.png";
    fs.writeFileSync(absOut, png);
    written.push(absOut);
  } catch {
    // /output is not writable here; the local copies are the deliverable.
  }
  console.log(`meme: ${W}x${H} PNG, ${png.length} bytes`);
  for (const p of written) console.log(`wrote ${p}`);
  console.log('joke: "GTA 6 LAUNCH WEEK / MY AGENT FINISHED THE STORY / AND GOT PAID ON MAKE.FUN"');
}

main();
