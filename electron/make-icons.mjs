// Dependency-free icon generator: emits a menu-bar template icon and an app icon.
// Draws at 4x supersample then box-downsamples for smooth edges.
import zlib from 'node:zlib'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── PNG encoder (RGBA, 8-bit) ─────────────────────────────────────
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ── Tiny canvas at supersample S ──────────────────────────────────
function makeCanvas(size, S = 4) {
  const w = size * S
  const buf = new Uint8ClampedArray(w * w * 4) // transparent
  const px = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= w || y >= w) return
    const i = (y * w + x) * 4
    // simple src-over onto existing
    const ia = a / 255, ib = 1 - ia
    buf[i] = r * ia + buf[i] * ib
    buf[i + 1] = g * ia + buf[i + 1] * ib
    buf[i + 2] = b * ia + buf[i + 2] * ib
    buf[i + 3] = Math.min(255, buf[i + 3] + a)
  }
  const inRound = (x, y, rx, ry, rw, rh, rad) => {
    if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) return false
    const cx = Math.min(Math.max(x, rx + rad), rx + rw - rad)
    const cy = Math.min(Math.max(y, ry + rad), ry + rh - rad)
    const dx = x - cx, dy = y - cy
    return dx * dx + dy * dy <= rad * rad || (x >= rx + rad && x < rx + rw - rad) || (y >= ry + rad && y < ry + rh - rad)
  }
  const api = {
    w, S,
    roundRect(x, y, rw, rh, rad, color) {
      x *= S; y *= S; rw *= S; rh *= S; rad *= S
      for (let py = Math.floor(y); py < y + rh; py++)
        for (let px2 = Math.floor(x); px2 < x + rw; px2++)
          if (inRound(px2, py, x, y, rw, rh, rad)) px(px2, py, color)
    },
    circle(cx, cy, r, color) {
      cx *= S; cy *= S; r *= S
      for (let py = Math.floor(cy - r); py <= cy + r; py++)
        for (let px2 = Math.floor(cx - r); px2 <= cx + r; px2++) {
          const dx = px2 - cx, dy = py - cy
          if (dx * dx + dy * dy <= r * r) px(px2, py, color)
        }
    },
    // downsample S×S box average → size×size RGBA Buffer
    finish() {
      const out = Buffer.alloc(size * size * 4)
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          let r = 0, g = 0, b = 0, a = 0
          for (let sy = 0; sy < S; sy++)
            for (let sx = 0; sx < S; sx++) {
              const i = ((y * S + sy) * w + (x * S + sx)) * 4
              r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3]
            }
          const n = S * S, o = (y * size + x) * 4
          out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n
        }
      return out
    },
  }
  return api
}

// draw a top hat (crown + brim) into a canvas, sized to `u` units, at offset
function drawHat(c, u, color) {
  const cw = u * 0.42, cx = (u - cw) / 2
  c.roundRect(cx, u * 0.14, cw, u * 0.52, u * 0.05, color)        // crown
  c.roundRect(u * 0.14, u * 0.58, u * 0.72, u * 0.14, u * 0.06, color) // brim
}

// ── Menu-bar template icon (black silhouette, alpha coverage) ─────
function trayIcon(size) {
  const c = makeCanvas(size, 4)
  drawHat(c, size, [0, 0, 0, 255])
  return encodePNG(size, size, Buffer.from(c.finish()))
}

// ── App icon: warm paper rounded square + ink hat + six dots ──────
function appIcon(size) {
  const c = makeCanvas(size, 3)
  const u = size
  c.roundRect(u * 0.06, u * 0.06, u * 0.88, u * 0.88, u * 0.22, [244, 241, 234, 255]) // paper card
  // ink hat, centered upper
  const hs = u * 0.5, hx = (u - hs) / 2, hy = u * 0.12
  const sub = makeCanvas(size, 3) // draw hat in its own space then blit? simpler: draw directly scaled
  // draw hat directly with manual coords
  const ink = [31, 30, 24, 255]
  c.roundRect(hx + hs * 0.29, hy + hs * 0.02, hs * 0.42, hs * 0.5, hs * 0.05, ink)   // crown
  c.roundRect(hx + hs * 0.06, hy + hs * 0.44, hs * 0.88, hs * 0.16, hs * 0.07, ink)  // brim
  // six dots row
  const dots = ['#9ca3af', '#f87171', '#374151', '#facc15', '#4ade80', '#60a5fa'].map(hex => [
    parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255,
  ])
  const r = u * 0.045, gap = u * 0.028
  const total = dots.length * (r * 2) + (dots.length - 1) * gap
  let x = (u - total) / 2 + r
  const y = u * 0.72
  for (const d of dots) { c.circle(x, y, r, [31, 30, 24, 255]); c.circle(x, y, r * 0.82, d); x += r * 2 + gap }
  return encodePNG(size, size, Buffer.from(c.finish()))
}

fs.mkdirSync(join(ROOT, 'build'), { recursive: true })
fs.writeFileSync(join(__dirname, 'trayTemplate.png'), trayIcon(22))
fs.writeFileSync(join(__dirname, 'trayTemplate@2x.png'), trayIcon(44))
fs.writeFileSync(join(ROOT, 'build', 'icon.png'), appIcon(1024))
console.log('icons written: electron/trayTemplate.png (+@2x), build/icon.png')
