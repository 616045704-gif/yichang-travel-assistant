import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const root = new URL('../miniprogram/assets/icons/', import.meta.url);
const providedRoot = new URL('../miniprogram/assets/provided/', import.meta.url);
const palette = { purple: [116, 84, 216, 255], yellow: [246, 198, 68, 255], lilac: [155, 147, 166, 255], clear: [0, 0, 0, 0] };

function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(kind, data) { const name = Buffer.from(kind); const header = Buffer.alloc(8); header.writeUInt32BE(data.length); name.copy(header, 4); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([header, data, tail]); }
function png(width, height, paint) {
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) { pixels[y * (width * 4 + 1)] = 0; for (let x = 0; x < width; x += 1) paint(x, y, (color) => Buffer.from(color).copy(pixels, y * (width * 4 + 1) + 1 + x * 4)); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
function distanceToSegment(px, py, ax, ay, bx, by) { const vx = bx - ax; const vy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - (ax + vx * t), py - (ay + vy * t)); }
function icon(name, size, color, isCategory = false) {
  const scale = size / 64;
  return png(size, size, (x, y, set) => {
    const px = x / scale; const py = y / scale;
    const dot = (cx, cy, radius) => Math.hypot(px - cx, py - cy) <= radius;
    const triangle = (cx, top, halfWidth, bottom) => py >= top && py <= bottom && Math.abs(px - cx) <= (py - top) * halfWidth / (bottom - top);
    if (isCategory) {
      let filled = false;
      if (name === 'scenic') filled = triangle(25, 25, 16, 50) || triangle(42, 30, 13, 50) || (py >= 49 && py <= 53 && px >= 11 && px <= 55);
      else if (name === 'restaurant') filled = (px >= 11 && px <= 15 && py >= 12 && py <= 46) || (px >= 20 && px <= 24 && py >= 12 && py <= 46) || (px >= 15 && px <= 20 && py >= 28 && py <= 51) || (px >= 36 && px <= 42 && py >= 12 && py <= 51) || (px >= 32 && px <= 46 && py >= 12 && py <= 25) || (py >= 49 && py <= 53 && px >= 10 && px <= 52);
      else if (name === 'culture') filled = triangle(32, 12, 24, 27) || (py >= 27 && py <= 32 && px >= 12 && px <= 52) || (py >= 31 && py <= 51 && ((px >= 17 && px <= 23) || (px >= 29 && px <= 35) || (px >= 41 && px <= 47))) || (py >= 49 && py <= 53 && px >= 11 && px <= 53);
      else filled = triangle(31, 17, 22, 51) && !(triangle(31, 32, 9, 51)) || (py >= 49 && py <= 53 && px >= 9 && px <= 55);
      if (filled) set(color);
      if (name === 'scenic' && dot(45, 17, 5)) set(palette.yellow);
      if ((name === 'restaurant' || name === 'culture') && dot(47, 16, 5)) set(palette.yellow);
      if (name === 'camping' && dot(17, 18, 3)) set(palette.yellow);
      return;
    }
    let solid = false;
    if (name === 'home') solid = triangle(32, 11, 23, 34) || (py >= 30 && py <= 52 && px >= 13 && px <= 51) && !(px >= 26 && px <= 38 && py >= 38);
    else if (name === 'discover') solid = dot(27, 27, 14) || Math.abs(px - py) < 4 && px >= 37 && px <= 53 && py >= 37 && py <= 53;
    else if (name === 'map') solid = (px >= 12 && px <= 25 && py >= 16 && py <= 50) || (px >= 27 && px <= 38 && py >= 14 && py <= 52) || (px >= 40 && px <= 52 && py >= 16 && py <= 50);
    else if (name === 'me') solid = dot(32, 22, 10) || (((px - 32) / 20) ** 2 + ((py - 52) / 15) ** 2 <= 1 && py >= 37);
    if (solid) { set(color); return; }
    const stroke = 2.25;
    const line = (...points) => points.some(([ax, ay, bx, by]) => distanceToSegment(px, py, ax, ay, bx, by) <= stroke);
    const circle = (cx, cy, radius) => Math.abs(Math.hypot(px - cx, py - cy) - radius) <= stroke;
    let mark = false;
    if (name === 'home') mark = line([12, 29, 32, 13], [32, 13, 52, 29], [12, 29, 12, 50], [52, 29, 52, 50], [12, 50, 26, 50], [38, 50, 52, 50], [26, 50, 26, 38], [38, 50, 38, 38]) || dot(46, 19, 3);
    else if (name === 'discover') mark = circle(28, 28, 13) || line([38, 38, 51, 51], [23, 28, 28, 33], [28, 33, 35, 25]);
    else if (name === 'map') mark = line([13, 18, 26, 13], [26, 13, 39, 18], [39, 18, 51, 13], [13, 18, 13, 51], [13, 51, 26, 46], [26, 46, 39, 51], [39, 51, 51, 46], [51, 46, 51, 13], [26, 13, 26, 46], [39, 18, 39, 51]);
    else if (name === 'me') mark = circle(32, 23, 9) || line([15, 51, 17, 46], [17, 46, 23, 41], [23, 41, 32, 39], [32, 39, 41, 41], [41, 41, 47, 46], [47, 46, 49, 51]);
    else if (name === 'scenic') mark = line([10, 47, 25, 27], [25, 27, 35, 39], [35, 39, 42, 31], [42, 31, 54, 47], [10, 50, 54, 50]) || dot(44, 17, 5);
    else if (name === 'restaurant') mark = line([17, 13, 17, 31], [11, 13, 11, 24], [23, 13, 23, 24], [17, 31, 17, 51], [34, 13, 34, 28], [41, 13, 41, 28], [37, 33, 37, 51], [15, 51, 49, 51]) || dot(47, 16, 5);
    else if (name === 'culture') mark = line([12, 25, 32, 13], [32, 13, 52, 25], [16, 28, 48, 28], [18, 50, 46, 50], [22, 29, 22, 49], [32, 29, 32, 49], [42, 29, 42, 49]) || dot(47, 17, 5);
    else mark = line([12, 50, 31, 18], [31, 18, 52, 50], [22, 50, 31, 35], [31, 35, 41, 50], [9, 51, 55, 51]) || line([14, 18, 20, 18], [17, 15, 17, 21]);
    if (mark) set(color);
    if (isCategory && name === 'scenic' && dot(44, 17, 5)) set(palette.yellow);
    if (isCategory && (name === 'restaurant' || name === 'culture') && dot(47, 16, 5)) set(palette.yellow);
    if (isCategory && name === 'camping' && dot(17, 18, 3)) set(palette.yellow);
  });
}
function locationPin() {
  return png(60, 76, (x, y, set) => {
    const px = x + .5; const py = y + .5;
    const head = (px - 30) ** 2 + (py - 25) ** 2 <= 22 ** 2 && py <= 31;
    const tail = py >= 25 && py <= 71 && Math.abs(px - 30) <= 22 * (71 - py) / 46;
    if (head || tail) set(palette.purple);
    if ((px - 30) ** 2 + (py - 25) ** 2 <= 9 ** 2) set([255, 255, 255, 255]);
    if ((px - 30) ** 2 + (py - 25) ** 2 <= 3 ** 2) set(palette.yellow);
  });
}
function mapMarker() {
  return png(72, 88, (x, y, set) => {
    const px = x + .5; const py = y + .5;
    const head = ((px - 36) / 27) ** 2 + ((py - 31) / 27) ** 2 <= 1 && py <= 42;
    const tail = py >= 31 && py <= 82 && Math.abs(px - 36) <= 25 * (82 - py) / 51;
    if (head || tail) set(palette.purple);
    if ((px - 36) ** 2 + (py - 30) ** 2 <= 12 ** 2) set([255, 255, 255, 255]);
    if ((px - 36) ** 2 + (py - 27) ** 2 <= 4 ** 2) set(palette.yellow);
    const wave = Math.abs(py - (34 + Math.sin((px - 23) / 5) * 2)) <= 1.3 && px >= 23 && px <= 49;
    if (wave) set(palette.purple);
  });
}

const tabs = ['home', 'discover', 'map', 'me'];
for (const name of tabs) {
  await writeFile(new URL(`${name}.png`, root), icon(name, 81, palette.lilac));
  await writeFile(new URL(`${name}-active.png`, root), icon(name, 81, palette.purple));
}
for (const name of ['scenic', 'restaurant', 'culture', 'camping']) await writeFile(new URL(`category-${name}.png`, root), icon(name, 96, palette.purple, true));
await writeFile(new URL('location.png', root), locationPin());
await writeFile(new URL('map-marker.png', providedRoot), mapMarker());
