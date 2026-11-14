'use strict';

/**
 * Minimal MP4 audio demuxer: pulls the first AAC track out of an mp4/m4v and
 * wraps its samples in ADTS, so players that cannot handle the video codec
 * (for example AV1 inside mp4 on Windows) can still play the audio.
 *
 * No dependencies, no ffmpeg — just enough ISO-BMFF parsing for progressive
 * files produced by common encoders.
 */

const fs = require('fs');
const path = require('path');

const ADTS_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000,
  24000, 22050, 16000, 12000, 11025, 8000, 7350,
];

function boxes(buf, start, end) {
  const out = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    let header = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = Number(buf.readBigUInt64BE(pos + 8));
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) break;
    out.push({ type, start: pos, data: pos + header, end: pos + size, buf });
    pos += size;
  }
  return out;
}

function child(box, type) {
  return boxes(box.buf, box.data, box.end).find((b) => b.type === type) || null;
}

function findAll(box, type) {
  return boxes(box.buf, box.data, box.end).filter((b) => b.type === type);
}

function readUInt64(buf, pos) {
  return Number(buf.readBigUInt64BE(pos));
}

function readDescriptor(buf, pos, end) {
  if (pos >= end) return null;
  const tag = buf[pos++];
  let len = 0;
  for (let i = 0; i < 4 && pos < end; i++) {
    const byte = buf[pos++];
    len = (len << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) break;
  }
  const start = pos;
  return { tag, start, end: Math.min(end, start + len) };
}

function validAsc(asc) {
  if (!asc || asc.length < 2) return false;
  const objectType = asc[0] >> 3;
  const freqIndex = ((asc[0] & 0x07) << 1) | (asc[1] >> 7);
  const channels = (asc[1] >> 3) & 0x0f;
  return objectType >= 1 && objectType <= 5 && freqIndex <= 12 && channels >= 1 && channels <= 7;
}

function findAsc(buf, start, end, depth = 0) {
  let pos = start;
  while (pos + 2 <= end && depth < 8) {
    const d = readDescriptor(buf, pos, end);
    if (!d || d.end < d.start) break;

    if (d.tag === 0x05) {
      const asc = buf.subarray(d.start, d.end);
      if (validAsc(asc)) return asc;
    } else if (d.tag === 0x03) {
      let p = d.start + 2; // ES_ID
      if (p >= d.end) break;
      const flags = buf[p++];
      if (flags & 0x80) p += 2;
      if (flags & 0x40) {
        if (p >= d.end) break;
        p += buf[p] + 1;
      }
      if (flags & 0x20) p += 2;
      const found = findAsc(buf, p, d.end, depth + 1);
      if (found) return found;
    } else if (d.tag === 0x04) {
      const found = findAsc(buf, d.start + 13, d.end, depth + 1);
      if (found) return found;
    } else {
      const found = findAsc(buf, d.start, d.end, depth + 1);
      if (found) return found;
    }
    pos = d.end;
  }
  return null;
}

function parseTimescale(buf, mdhd) {
  if (!mdhd) return 0;
  const version = buf[mdhd.data];
  if (version === 1) {
    return {
      timescale: buf.readUInt32BE(mdhd.data + 20),
      duration: readUInt64(buf, mdhd.data + 24),
    };
  }
  return {
    timescale: buf.readUInt32BE(mdhd.data + 12),
    duration: buf.readUInt32BE(mdhd.data + 16),
  };
}

function parseStts(buf, stts) {
  if (!stts) return 0;
  const count = buf.readUInt32BE(stts.data + 4);
  let total = 0;
  for (let i = 0; i < count; i++) {
    const p = stts.data + 8 + i * 8;
    if (p + 8 > stts.end) break;
    total += buf.readUInt32BE(p) * buf.readUInt32BE(p + 4);
  }
  return total;
}

function adtsHeader(size, profile, freqIndex, channels) {
  const length = 7 + size;
  return Buffer.from([
    0xff,
    0xf1,
    ((profile & 0x03) << 6) | ((freqIndex & 0x0f) << 2) | ((channels >> 2) & 0x01),
    ((channels & 0x03) << 6) | ((length >> 11) & 0x03),
    (length >> 3) & 0xff,
    ((length & 0x07) << 5) | 0x1f,
    0xfc,
  ]);
}

function findAudioTrack(buf, moov) {
  for (const trak of findAll(moov, 'trak')) {
    const mdia = child(trak, 'mdia');
    if (!mdia) continue;
    const hdlr = child(mdia, 'hdlr');
    if (!hdlr || hdlr.data + 12 > hdlr.end) continue;
    const handler = buf.toString('latin1', hdlr.data + 8, hdlr.data + 12);
    if (handler !== 'soun') continue;

    const minf = child(mdia, 'minf');
    const stbl = minf && child(minf, 'stbl');
    if (!stbl) continue;

    return { trak, mdia, stbl };
  }
  return null;
}

/**
 * Extract the first AAC track into an ADTS .aac file next to the source.
 * Returns { file, duration, sampleRate, channels, frames } or throws.
 */
function extractAudio(source) {
  const buf = fs.readFileSync(source);
  const top = boxes(buf, 0, buf.length);
  const moov = top.find((b) => b.type === 'moov');
  if (!moov) throw new Error('no moov box');

  const track = findAudioTrack(buf, moov);
  if (!track) throw new Error('no audio track');
  if (buf.indexOf('moof') !== -1) throw new Error('fragmented mp4 is not supported');

  const stbl = track.stbl;
  const stsd = child(stbl, 'stsd');
  const stsz = child(stbl, 'stsz');
  const stsc = child(stbl, 'stsc');
  const stco = child(stbl, 'stco') || child(stbl, 'co64');
  const stts = child(stbl, 'stts');
  if (!stsd || !stsz || !stsc || !stco) throw new Error('incomplete sample tables');

  // sample description -------------------------------------------------
  const entryStart = stsd.data + 8;
  const entrySize = buf.readUInt32BE(entryStart);
  const format = buf.toString('latin1', entryStart + 4, entryStart + 8);
  if (format !== 'mp4a') throw new Error(`unsupported audio format ${format}`);

  const channels = buf.readUInt16BE(entryStart + 24) || 2;
  const sampleRate = buf.readUInt32BE(entryStart + 32) / 65536;

  let freqIndex = ADTS_RATES.indexOf(sampleRate);
  if (freqIndex < 0) {
    let bestDiff = Infinity;
    ADTS_RATES.forEach((rate, i) => {
      const diff = Math.abs(rate - sampleRate);
      if (diff < bestDiff) {
        bestDiff = diff;
        freqIndex = i;
      }
    });
  }

  // AudioSpecificConfig from esds --------------------------------------
  let asc = null;
  const entryEnd = Math.min(entryStart + entrySize, stsd.end);
  let esds = null;
  for (const b of boxes(buf, entryStart + 36, entryEnd)) {
    if (b.type === 'esds') {
      esds = b;
      break;
    }
  }
  if (!esds) {
    const idx = buf.indexOf('esds', entryStart);
    if (idx >= 0 && idx - 4 < entryEnd) {
      esds = { data: idx + 4, end: entryEnd, buf };
    }
  }
  if (esds) asc = findAsc(buf, esds.data + 4, esds.end);

  let profile = 1; // AAC-LC
  if (asc) {
    const objectType = asc[0] >> 3;
    profile = Math.max(0, Math.min(3, objectType === 5 ? 1 : objectType - 1));
    const ascFreq = ((asc[0] & 0x07) << 1) | (asc[1] >> 7);
    if (ascFreq <= 12) freqIndex = ascFreq;
  }

  // sample tables ------------------------------------------------------
  const constantSize = buf.readUInt32BE(stsz.data + 4);
  const sampleCount = buf.readUInt32BE(stsz.data + 8);
  const sizes = new Array(sampleCount);
  if (constantSize > 0) {
    sizes.fill(constantSize);
  } else {
    for (let i = 0; i < sampleCount; i++) {
      const p = stsz.data + 12 + i * 4;
      if (p + 4 > stsz.end) throw new Error('truncated stsz');
      sizes[i] = buf.readUInt32BE(p);
    }
  }

  const chunkOffsets = [];
  if (stco.type === 'stco') {
    const n = buf.readUInt32BE(stco.data + 4);
    for (let i = 0; i < n; i++) {
      const p = stco.data + 8 + i * 4;
      if (p + 4 > stco.end) break;
      chunkOffsets.push(buf.readUInt32BE(p));
    }
  } else {
    const n = buf.readUInt32BE(stco.data + 4);
    for (let i = 0; i < n; i++) {
      const p = stco.data + 8 + i * 8;
      if (p + 8 > stco.end) break;
      chunkOffsets.push(readUInt64(buf, p));
    }
  }

  const stscEntries = [];
  const stscCount = buf.readUInt32BE(stsc.data + 4);
  for (let i = 0; i < stscCount; i++) {
    const p = stsc.data + 8 + i * 12;
    if (p + 12 > stsc.end) break;
    stscEntries.push({
      firstChunk: buf.readUInt32BE(p),
      samplesPerChunk: buf.readUInt32BE(p + 4),
    });
  }
  if (!stscEntries.length) throw new Error('empty stsc');

  // assemble ADTS frames ----------------------------------------------
  const parts = [];
  let sampleIdx = 0;
  let entryIdx = 0;

  for (let c = 0; c < chunkOffsets.length && sampleIdx < sizes.length; c++) {
    while (entryIdx + 1 < stscEntries.length && stscEntries[entryIdx + 1].firstChunk <= c + 1) {
      entryIdx++;
    }
    let offset = chunkOffsets[c];
    const perChunk = stscEntries[entryIdx].samplesPerChunk;
    for (let k = 0; k < perChunk && sampleIdx < sizes.length; k++) {
      const size = sizes[sampleIdx++];
      if (size <= 0) continue;
      if (offset + size > buf.length) throw new Error('sample outside file');
      parts.push(adtsHeader(size, profile, freqIndex, channels));
      parts.push(buf.subarray(offset, offset + size));
      offset += size;
    }
  }

  if (!parts.length) throw new Error('no audio samples');

  const outFile = path.join(
    path.dirname(source),
    path.basename(source, path.extname(source)) + '.audio.aac'
  );
  const tmp = outFile + '.tmp';
  fs.writeFileSync(tmp, Buffer.concat(parts));
  fs.renameSync(tmp, outFile);

  const timing = parseTimescale(buf, child(track.mdia, 'mdhd'));
  let duration = 0;
  if (timing.timescale > 0) {
    const total = parseStts(buf, stts) || timing.duration;
    duration = total / timing.timescale;
  }
  if (!duration && sampleRate > 0) duration = (sampleIdx * 1024) / sampleRate;

  return {
    file: outFile,
    duration,
    sampleRate,
    channels,
    frames: sampleIdx,
  };
}

module.exports = { extractAudio };

if (require.main === module) {
  const source = process.argv[2];
  if (!source) {
    console.error('usage: node mp4-audio.js <file.mp4>');
    process.exit(1);
  }
  try {
    const info = extractAudio(path.resolve(source));
    console.log(JSON.stringify(info, null, 2));
  } catch (err) {
    console.error('extract failed:', err.message);
    process.exit(1);
  }
}
