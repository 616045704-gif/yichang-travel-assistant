import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const root = new URL('../miniprogram/assets/icons/', import.meta.url);
const palette = { purple: [43, 23, 77, 255], yellow: [255, 196, 0, 255], lilac: [207, 194, 255, 255], clear: [0, 0, 0, 0] };

function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(kind, data) { const name = Buffer.from(kind); const header = Buffer.alloc(8); header.writeUInt32BE(data.length); name.copy(header, 4); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([header, data, tail]); }
function png(width, height, paint) {
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) { pixels[y * (width * 4 + 1)] = 0; for (let x = 0; x < width; x += 1) paint(x, y, (color) => Buffer.from(color).copy(pixels, y * (width * 4 + 1) + 1 + x * 4)); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
function insideRounded(x, y, size, radius) { const qx = Math.max(radius - x, 0, x - (size - radius - 1)); const qy = Math.max(radius - y, 0, y - (size - radius - 1)); return qx * qx + qy * qy <= radius * radius; }
function icon(name, size, color, isCategory = false) {
  const scale = size / 64;
  return png(size, size, (x, y, set) => {
    const px = x / scale; const py = y / scale;
    if (isCategory && insideRounded(px - 3, py - 3, 58, 18)) set(palette.yellow);
    const outer = !isCategory && ((px - 32) ** 2 + (py - 32) ** 2 < 22 ** 2);
    if (outer) set(color);
    const dark = palette.purple;
    const motif = name === 'home' ? (py > 27 && py < 50 && Math.abs(px - 32) < (50 - py) * .75) : name === 'discover' ? ((px - 32) ** 2 + (py - 32) ** 2 < 11 ** 2) : name === 'map' ? (py > 18 && py < 46 && (px > 22 && px < 28 || px > 36 && px < 42)) : name === 'me' ? ((px - 32) ** 2 + (py - 24) ** 2 < 8 ** 2 || (py > 35 && (px - 32) ** 2 + (py - 52) ** 2 < 20 ** 2)) : name === 'location' ? ((px - 32) ** 2 + (py - 26) ** 2 < 8 ** 2) : name === 'scenic' ? (py > 26 && py < 50 && Math.abs(px - 30) < py - 24) : name === 'restaurant' ? (py > 29 && py < 45 && Math.abs(px - 32) < 20) : name === 'culture' ? (py > 28 && py < 51 && px > 15 && px < 49) : (py > 27 && py < 50 && Math.abs(px - 32) < py - 22);
    if (isCategory ? motif : motif && outer) set(dark);
  });
}
function locationPin() {
  return png(60, 76, (x, y, set) => {
    const px = x + .5; const py = y + .5;
    const head = (px - 30) ** 2 + (py - 25) ** 2 <= 22 ** 2 && py <= 31;
    const tail = py >= 25 && py <= 71 && Math.abs(px - 30) <= 22 * (71 - py) / 46;
    if (head || tail) set(palette.yellow);
    if ((px - 30) ** 2 + (py - 25) ** 2 <= 9 ** 2) set(palette.purple);
  });
}

const tabs = ['home', 'discover', 'map', 'me'];
for (const name of tabs) {
  await writeFile(new URL(`${name}.png`, root), icon(name, 81, palette.lilac));
  await writeFile(new URL(`${name}-active.png`, root), icon(name, 81, palette.yellow));
}
for (const name of ['scenic', 'restaurant', 'culture', 'camping']) await writeFile(new URL(`category-${name}.png`, root), icon(name, 96, palette.yellow, true));
await writeFile(new URL('location.png', root), locationPin());
