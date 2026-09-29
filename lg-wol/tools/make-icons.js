#!/usr/bin/env node
/*
 * Icon generator.
 *
 * ares-package refuses to build without icon.png (80x80) and largeIcon.png
 * (130x130), and neither can be committed as a text file. So the icons are
 * drawn here, in code, from nothing but Node's zlib - no ImageMagick, no sharp,
 * no binary blobs in the repository. Change the numbers below and re-run
 * `npm run icons` to get new artwork.
 *
 *   node tools/make-icons.js
 *
 * Output: icon.png, largeIcon.png, store/icon-400.png
 *
 * The mark is a power symbol (a ring broken at the top with a bar through the
 * gap) on a dark rounded tile, with a soft glow suggesting a broadcast. It is
 * drawn with 16 samples per pixel, which is what keeps the small sizes clean.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var ROOT = path.join(__dirname, '..');

// Colours, 0-255.
var BG_TOP = [24, 38, 64];
var BG_BOTTOM = [10, 16, 28];
var BORDER = [130, 160, 220];
var ACCENT = [53, 224, 138];

// Geometry as a fraction of the icon's width, so every size stays identical in
// proportion.
var GEO = {
  radius: 0.225,        // corner radius of the tile
  centerY: 0.525,
  ringRadius: 0.235,
  ringThickness: 0.062,
  ringGapDegrees: 36,   // half-width of the gap at the top
  barWidth: 0.058,
  barFrom: 0.285,       // top of the bar, as a fraction of size
  barTo: 0.505,         // bottom of the bar
  glowWidth: 0.10,
  glowStrength: 0.22,
  borderWidth: 1.4      // in pixels at the delivered size
};

var TARGETS = [
  { file: 'icon.png', size: 80, samples: 4 },
  { file: 'largeIcon.png', size: 130, samples: 4 },
  { file: path.join('store', 'icon-400.png'), size: 400, samples: 2 }
];

/* ------------------------------------------------------------------ geometry */

function distance2(a, b) {
  return Math.sqrt(a * a + b * b);
}

// Signed distance to a rounded rectangle centred in a size x size box.
// Negative inside, positive outside, zero on the edge.
function roundedRectDistance(x, y, size, radius) {
  var half = size / 2;
  var dx = Math.abs(x - half) - (half - radius);
  var dy = Math.abs(y - half) - (half - radius);
  var outside = distance2(Math.max(dx, 0), Math.max(dy, 0));
  var inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - radius;
}

function mix(base, over, alpha) {
  return [
    base[0] + (over[0] - base[0]) * alpha,
    base[1] + (over[1] - base[1]) * alpha,
    base[2] + (over[2] - base[2]) * alpha
  ];
}

function clamp01(value) {
  return value < 0 ? 0 : (value > 1 ? 1 : value);
}

/* --------------------------------------------------------------- the mark */

// Returns [r, g, b, a] for one sample point, already composited.
function sample(x, y, size) {
  var distance = roundedRectDistance(x, y, size, GEO.radius * size);
  if (distance > 0) return [0, 0, 0, 0];

  var t = clamp01(y / size);
  var color = [
    BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t,
    BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t,
    BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t
  ];

  // Hairline border, inset just inside the tile edge.
  if (distance > -GEO.borderWidth) {
    var edgeAlpha = clamp01((distance + GEO.borderWidth) / GEO.borderWidth);
    color = mix(color, BORDER, 0.16 * edgeAlpha);
  }

  var cx = size * 0.5;
  var cy = size * GEO.centerY;
  var dx = x - cx;
  var dy = y - cy;
  var radial = distance2(dx, dy);

  var ringRadius = GEO.ringRadius * size;
  var ringThickness = GEO.ringThickness * size;

  // Soft glow around the ring, drawn under it.
  var glow = 1 - Math.abs(radial - ringRadius) / (GEO.glowWidth * size);
  if (glow > 0) {
    color = mix(color, ACCENT, GEO.glowStrength * glow);
  }

  // The ring, broken at the top.
  if (Math.abs(radial - ringRadius) <= ringThickness / 2) {
    var angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180, -90 is straight up
    var gap = GEO.ringGapDegrees;
    var inGap = angle > (-90 - gap) && angle < (-90 + gap);
    if (!inGap) {
      color = mix(color, ACCENT, 1);
    }
  }

  // The bar through the gap.
  var barLeft = cx - (GEO.barWidth * size) / 2;
  var barRight = cx + (GEO.barWidth * size) / 2;
  var barTop = size * GEO.barFrom;
  var barBottom = size * GEO.barTo;
  if (x >= barLeft && x <= barRight && y >= barTop && y <= barBottom) {
    color = mix(color, ACCENT, 1);
  }

  return [color[0], color[1], color[2], 1];
}

/* --------------------------------------------------------------- rasterise */

// Supersampled render to a straight (non-premultiplied) RGBA byte array.
function render(size, samples) {
  var out = Buffer.alloc(size * size * 4);
  var total = samples * samples;

  for (var py = 0; py < size; py++) {
    for (var px = 0; px < size; px++) {
      var sumR = 0, sumG = 0, sumB = 0, sumA = 0;

      for (var sy = 0; sy < samples; sy++) {
        for (var sx = 0; sx < samples; sx++) {
          var x = px + (sx + 0.5) / samples;
          var y = py + (sy + 0.5) / samples;
          var c = sample(x, y, size);
          // Accumulate premultiplied so the tile's edges stay neutral.
          sumR += c[0] * c[3];
          sumG += c[1] * c[3];
          sumB += c[2] * c[3];
          sumA += c[3];
        }
      }

      var alpha = sumA / total;
      var offset = (py * size + px) * 4;

      if (alpha <= 0.0001) {
        out[offset] = 0;
        out[offset + 1] = 0;
        out[offset + 2] = 0;
        out[offset + 3] = 0;
      } else {
        // Un-premultiply back to straight alpha.
        out[offset] = Math.round(clamp01(sumR / sumA / 255) * 255);
        out[offset + 1] = Math.round(clamp01(sumG / sumA / 255) * 255);
        out[offset + 2] = Math.round(clamp01(sumB / sumA / 255) * 255);
        out[offset + 3] = Math.round(clamp01(alpha) * 255);
      }
    }
  }

  return out;
}

/* ------------------------------------------------------------- PNG writing */

var CRC_TABLE = (function () {
  var table = new Int32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}());

function crc32(buffer) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  var length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  var typeBuffer = Buffer.from(type, 'ascii');
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  var signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: truecolour with alpha
  ihdr[10] = 0;  // compression: deflate
  ihdr[11] = 0;  // filter method: adaptive
  ihdr[12] = 0;  // interlace: none

  // Every scanline is prefixed with its filter type; 0 means "no filter",
  // which compresses more than well enough for flat artwork like this.
  var stride = width * 4;
  var raw = Buffer.alloc((stride + 1) * height);
  for (var y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  var idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* -------------------------------------------------------------------- main */

// The names in TARGETS are literals, but a build step that writes wherever a
// joined path happens to point is not worth trusting. Resolve, then confirm the
// result is still inside the project.
function resolveWithinRoot(relativeName) {
  var root = path.resolve(ROOT);
  var target = path.resolve(root, relativeName);
  if (target !== root && target.indexOf(root + path.sep) !== 0) {
    throw new Error('Refusing to write outside the project root: ' + relativeName);
  }
  return target;
}

function ensureDirectory(dir) {
  if (!dir || dir === path.resolve(ROOT)) return;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  console.log('Wake On LAN - generating icons');

  TARGETS.forEach(function (target) {
    var destination = resolveWithinRoot(target.file);
    ensureDirectory(path.dirname(destination));

    var pixels = render(target.size, target.samples);
    var png = encodePng(target.size, target.size, pixels);
    fs.writeFileSync(destination, png);

    console.log('  ' + target.file + '  ' + target.size + 'x' + target.size +
      '  (' + target.samples + 'x supersampled, ' + png.length + ' bytes)');
  });

  console.log('Done. ares-package will pick these up automatically.');
}

if (require.main === module) {
  main();
}

module.exports = {
  render: render,
  encodePng: encodePng,
  crc32: crc32,
  sample: sample,
  roundedRectDistance: roundedRectDistance,
  resolveWithinRoot: resolveWithinRoot
};
