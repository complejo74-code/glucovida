// Genera los íconos PWA de GlucoVida (paso 11) sin dependencias externas.
//
//   node scripts/gen-pwa-icons.mjs
//
// Marca: corazón blanco (el glifo 🩵 del branding) sobre el gradiente celeste
// de marca (#22A7E6 → #1D90C7). Solo usa builtins de Node (zlib) para escribir
// PNG RGBA — el repo no tiene sharp/ImageMagick. Salida: public/icons/.
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../public/icons");
mkdirSync(OUT, { recursive: true });

// ── CRC32 + PNG encoder (color type 6 = RGBA) ────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression, filter, interlace = 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ── Formas ───────────────────────────────────────────────────────────────────
// Corazón implícito (y hacia arriba): (x² + y² − 1)³ − x²·y³ ≤ 0
function insideHeart(x, y) {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
}
// bbox del corazón, calculada por muestreo fino
function heartBBox() {
  let minX = 9, maxX = -9, minY = 9, maxY = -9;
  const S = 2000;
  for (let i = 0; i <= S; i++) {
    const x = -1.6 + (3.2 * i) / S;
    for (let j = 0; j <= S; j++) {
      const y = -1.6 + (3.2 * j) / S;
      if (insideHeart(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY };
}
const HB = heartBBox();

function lerp(a, b, t) { return a + (b - a) * t; }
// Gradiente vertical celeste de marca (docs/BRANDING.md §3–4)
const TOP = [0x22, 0xa7, 0xe6]; // #22A7E6 primary
const BOT = [0x1d, 0x90, 0xc7]; // #1D90C7 primary-strong

// Genera un ícono NxN.
//  content: fracción del lienzo ocupada por el corazón (safe-zone)
//  fullBleed: true = fondo cuadrado completo (maskable / apple); false = cuadrado
//             redondeado con esquinas transparentes (íconos "any")
function drawIcon(N, { content, fullBleed }) {
  const SS = 4; // supersampling para bordes suaves
  const rgba = Buffer.alloc(N * N * 4);
  const radius = N * 0.22; // radio de esquina para el cuadrado redondeado

  // Escala del corazón dentro del content box, centrado
  const hW = HB.maxX - HB.minX;
  const hH = HB.maxY - HB.minY;
  const box = N * content;
  const scale = box / Math.max(hW, hH);
  const hcx = (HB.minX + HB.maxX) / 2;
  const hcy = (HB.minY + HB.maxY) / 2;

  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      let pr = 0, pg = 0, pb = 0, pa = 0; // acumulador premultiplicado
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = px + (sx + 0.5) / SS;
          const fy = py + (sy + 0.5) / SS;

          // ¿dentro del fondo?
          let inBg;
          if (fullBleed) {
            inBg = true;
          } else {
            // rounded rect
            const dx = Math.max(radius - fx, fx - (N - radius), 0);
            const dy = Math.max(radius - fy, fy - (N - radius), 0);
            inBg = dx * dx + dy * dy <= radius * radius;
          }
          if (!inBg) continue; // fuera → transparente

          // color de fondo (gradiente vertical)
          const t = fy / N;
          let r = lerp(TOP[0], BOT[0], t);
          let g = lerp(TOP[1], BOT[1], t);
          let b = lerp(TOP[2], BOT[2], t);

          // ¿dentro del corazón? → blanco
          const hxu = (fx - N / 2) / scale + hcx;
          const hyu = -(fy - N / 2) / scale + hcy; // y invertida (pantalla ↓, math ↑)
          if (insideHeart(hxu, hyu)) { r = 255; g = 255; b = 255; }

          // premultiplicado (alpha = 1 en este subpixel)
          pr += r; pg += g; pb += b; pa += 1;
        }
      }
      const n = SS * SS;
      const alpha = pa / n;
      const idx = (py * N + px) * 4;
      if (alpha === 0) {
        rgba[idx] = rgba[idx + 1] = rgba[idx + 2] = rgba[idx + 3] = 0;
      } else {
        // des-premultiplicar
        rgba[idx] = Math.round(pr / pa);
        rgba[idx + 1] = Math.round(pg / pa);
        rgba[idx + 2] = Math.round(pb / pa);
        rgba[idx + 3] = Math.round(alpha * 255);
      }
    }
  }
  return encodePNG(N, N, rgba);
}

// ── Salidas ──────────────────────────────────────────────────────────────────
const targets = [
  ["icon-192.png", 192, { content: 0.6, fullBleed: false }],
  ["icon-512.png", 512, { content: 0.6, fullBleed: false }],
  // maskable: contenido dentro de la safe-zone (~80%) → content 0.5, full-bleed
  ["icon-maskable-512.png", 512, { content: 0.5, fullBleed: true }],
  // apple-touch: iOS enmascara las esquinas → full-bleed, sin transparencia
  ["apple-touch-icon.png", 180, { content: 0.58, fullBleed: true }],
];
for (const [name, size, opts] of targets) {
  const png = drawIcon(size, opts);
  writeFileSync(resolve(OUT, name), png);
  console.log(`✓ ${name} (${size}x${size}, ${png.length} bytes)`);
}
console.log(`Íconos escritos en ${OUT}`);
