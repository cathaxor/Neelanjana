#!/usr/bin/env node
/**
 * Neelanjana — a tiny terminal music player with synced Banglish lyrics.
 *
 *   node neelanjana.js
 *   node neelanjana.js --start 1:10 --script both
 *
 * Audio comes from the mp4/mp3 next to this script, lyrics from
 * Neelanjana.banglish.lrc (or the original LRC). No npm packages needed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');
const { extractAudio } = require('./mp4-audio');

const ROOT = __dirname;
const SONG_TITLE = 'Neelanjana';
const ARTIST = 'Encore';
const DEFAULT_AUDIO = ['Neelanjana.mp4', 'Neelanjana.m4a', 'Neelanjana.mp3'];
const DEFAULT_LRC = ['Neelanjana.banglish.lrc', 'Encore - Neelanjana.lrc'];

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = {
    audio: null,
    lrc: null,
    script: 'banglish',
    start: 0,
    volume: 0.85,
    sync: 0,
    demo: false,
    color: true,
    plain: false,
    help: false,
    version: false,
  };

  const takeValue = (i, inline, name) => {
    if (inline !== undefined) return { value: inline, next: i };
    if (i + 1 >= argv.length) die(`missing value for ${name}`);
    return { value: argv[i + 1], next: i + 1 };
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      if (!opts.audio) opts.audio = arg;
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    let r;

    switch (name) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '--version':
        opts.version = true;
        break;
      case '-f':
      case '--file':
      case '--audio':
        r = takeValue(i, inline, name);
        opts.audio = r.value;
        i = r.next;
        break;
      case '-l':
      case '--lrc':
        r = takeValue(i, inline, name);
        opts.lrc = r.value;
        i = r.next;
        break;
      case '--script':
        r = takeValue(i, inline, name);
        opts.script = r.value;
        i = r.next;
        break;
      case '-s':
      case '--start':
        r = takeValue(i, inline, name);
        opts.start = parseTime(r.value);
        i = r.next;
        break;
      case '-v':
      case '--volume':
        r = takeValue(i, inline, name);
        opts.volume = clamp(Number(r.value) / 100, 0, 1);
        i = r.next;
        break;
      case '--sync':
        r = takeValue(i, inline, name);
        opts.sync = Number(r.value);
        i = r.next;
        break;
      case '--demo':
        opts.demo = true;
        break;
      case '--no-color':
        opts.color = false;
        break;
      case '--plain':
        opts.plain = true;
        break;
      default:
        die(`unknown option: ${arg} (try --help)`);
    }
  }

  if (!['banglish', 'bengali', 'both'].includes(opts.script)) {
    die(`--script must be banglish, bengali or both (got "${opts.script}")`);
  }
  if (!Number.isFinite(opts.start) || opts.start < 0) die('invalid --start time');
  if (!Number.isFinite(opts.volume)) die('invalid --volume');
  if (!Number.isFinite(opts.sync)) die('invalid --sync value');
  opts.sync = clamp(opts.sync, -30, 30);

  return opts;
}

function die(msg) {
  console.error(`neelanjana: ${msg}`);
  process.exit(1);
}

function parseTime(value) {
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const m = value.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function fmt(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------- lrc

function parseLrc(text) {
  const meta = {};
  const lines = [];

  for (const raw of text.split(/\r?\n/)) {
    const metaMatch = raw.match(/^\[([a-zA-Z#]+):(.*)\]$/);
    if (metaMatch) {
      meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      continue;
    }
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const body = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const s of stamps) {
      lines.push({ t: Number(s[1]) * 60 + Number(s[2]), text: body });
    }
  }

  lines.sort((a, b) => a.t - b.t);
  return { meta, lines };
}

function resolveFile(explicit, candidates, base) {
  if (explicit) {
    const p = path.resolve(base, explicit);
    if (!fs.existsSync(p)) die(`file not found: ${p}`);
    return p;
  }
  for (const c of candidates) {
    const p = path.resolve(base, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Merge the banglish and bengali lyric files by timestamp so the UI can
 * switch scripts instantly without reloading anything.
 */
function loadSong(banglishPath, bengaliPath) {
  const banglish = fs.existsSync(banglishPath)
    ? parseLrc(fs.readFileSync(banglishPath, 'utf8'))
    : { meta: {}, lines: [] };
  const bengali = bengaliPath && fs.existsSync(bengaliPath)
    ? parseLrc(fs.readFileSync(bengaliPath, 'utf8'))
    : { meta: {}, lines: [] };

  const bengaliByTime = new Map();
  for (const line of bengali.lines) {
    if (!line.text) continue;
    bengaliByTime.set(line.t.toFixed(2), line.text);
  }

  const master = banglish.lines.length ? banglish : bengali;

  const boundaries = new Map();
  for (const line of [...banglish.lines, ...bengali.lines]) {
    boundaries.set(line.t.toFixed(2), line.t);
  }
  const boundaryTimes = [...boundaries.values()].sort((a, b) => a - b);
  const nextBoundary = (time) => {
    for (const b of boundaryTimes) {
      if (b > time + 0.001) return b;
    }
    return time + 6;
  };

  const lines = master.lines
    .filter((line) => line.text)
    .map((line) => {
      let bn = bengaliByTime.get(line.t.toFixed(2)) || '';
      if (!bn) {
        // Tolerate small timestamp differences between files.
        let best = null;
        for (const [key, text] of bengaliByTime) {
          const diff = Math.abs(Number(key) - line.t);
          if (diff < 0.35 && (!best || diff < best.diff)) best = { diff, text };
        }
        if (best) bn = best.text;
      }
      return {
        t: line.t,
        banglish: banglish.lines.length ? line.text : '',
        bengali: bn || (bengali.lines.length && !banglish.lines.length ? line.text : ''),
        // The next timestamp of any kind (even an empty marker) closes this
        // line, so instrumental breaks are not swallowed by the previous line.
        nextT: nextBoundary(line.t),
      };
    })
    .filter((line) => line.banglish || line.bengali);

  const meta = { ...bengali.meta, ...banglish.meta, ...master.meta };
  return { meta, lines };
}

function mediaDuration(file) {
  try {
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r');
    const length = Math.min(size, 4 * 1024 * 1024);
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, 0);
    fs.closeSync(fd);

    const idx = buf.indexOf('mvhd');
    if (idx < 0 || idx + 32 > buf.length) return null;
    const version = buf[idx + 4];
    const timescale = version === 1
      ? buf.readUInt32BE(idx + 24)
      : buf.readUInt32BE(idx + 16);
    const duration = version === 1
      ? Number(buf.readBigUInt64BE(idx + 28))
      : buf.readUInt32BE(idx + 20);
    if (!timescale) return null;
    return duration / timescale;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- audio

function commandExists(cmd) {
  if (!/^[\w.-]+$/.test(cmd)) return false;
  const probe = spawnSync(cmd, ['-version'], { stdio: 'ignore', windowsHide: true });
  return !probe.error;
}

class Player {
  constructor(file, { start, volume }) {
    this.file = file;
    this.startAt = start;
    this.volume = volume;
    this.child = null;
    this.rl = null;
    this.alive = false;
    this.kind = 'none';
    this.handlers = Object.create(null);
    this.stderr = '';
  }

  on(event, fn) {
    (this.handlers[event] = this.handlers[event] || []).push(fn);
    return this;
  }

  emit(event, ...args) {
    for (const fn of this.handlers[event] || []) fn(...args);
  }

  start() {
    this.stopped = false;
    if (process.platform === 'win32') {
      const script = path.join(ROOT, 'players', 'win-mediaplayer.ps1');
      if (fs.existsSync(script)) {
        this.kind = 'windows-mediaplayer';
        this.spawnWindows(script);
        return;
      }
    }
    this.startPosix();
  }

  spawnWindows(script) {
    const child = spawn(
      'powershell.exe',
      [
        '-NoLogo', '-NoProfile', '-STA',
        '-ExecutionPolicy', 'Bypass',
        '-File', script,
        '-Media', this.file,
        '-StartAt', String(this.startAt),
        '-Volume', String(this.volume),
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    this.attach(child, (line) => {
      if (line === 'READY') {
        this.alive = true;
        this.emit('ready');
      } else if (line.startsWith('POS ')) {
        const pos = Number(line.slice(4));
        if (Number.isFinite(pos)) this.emit('position', pos);
      } else if (line.startsWith('ERR ')) {
        this.emit('error', line.slice(4));
      } else if (line.startsWith('WARN ')) {
        this.emit('warning', line.slice(5));
      }
    });
  }

  startPosix() {
    if (commandExists('ffplay')) {
      this.kind = 'ffplay';
      const child = spawn(
        'ffplay',
        [
          '-nodisp', '-autoexit', '-loglevel', 'error',
          '-volume', String(Math.round(this.volume * 100)),
          '-ss', String(this.startAt),
          this.file,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );
      this.attach(child, () => {});
      this.alive = true;
      this.emit('ready');
      return;
    }

    if (commandExists('mpv')) {
      this.kind = 'mpv';
      const child = spawn(
        'mpv',
        [
          '--no-video', '--really-quiet',
          `--volume=${Math.round(this.volume * 100)}`,
          `--start=${this.startAt}`,
          this.file,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );
      this.attach(child, () => {});
      this.alive = true;
      this.emit('ready');
      return;
    }

    if (process.platform === 'darwin' && commandExists('afplay')) {
      this.kind = 'afplay';
      if (this.startAt > 0) {
        this.emit('error', 'afplay cannot seek — starting from the beginning');
      }
      const child = spawn('afplay', ['-v', String(this.volume), this.file], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      this.attach(child, () => {});
      this.alive = true;
      this.emit('ready');
      return;
    }

    this.emit('error', 'no audio player found (install ffmpeg/mpv, or run --demo)');
  }

  attach(child, onLine) {
    this.child = child;
    this.stderr = '';

    if (child.stdout) {
      this.rl = readline.createInterface({ input: child.stdout });
      this.rl.on('line', (line) => onLine(line.replace(/^\uFEFF/, '').trim()));
    }
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        this.stderr = (this.stderr + chunk).slice(-4000);
      });
    }

    child.on('error', (err) => {
      this.alive = false;
      this.emit('error', err.message);
    });

    child.on('exit', (code) => {
      const wasAlive = this.alive;
      this.alive = false;
      this.rl && this.rl.close();
      if (wasAlive && code && code !== 0) {
        const detail = this.stderr.trim().split(/\r?\n/).pop() || `exit ${code}`;
        this.emit('error', detail);
      }
      this.emit('exit', code);
    });
  }

  send(line) {
    if (this.child && this.child.stdin && !this.child.stdin.destroyed) {
      try {
        this.child.stdin.write(line + '\n');
      } catch {
        /* player already gone */
      }
    }
  }

  pause() {
    if (this.kind === 'windows-mediaplayer') this.send('pause');
    else this.signal('SIGSTOP');
  }

  resume() {
    if (this.kind === 'windows-mediaplayer') this.send('resume');
    else this.signal('SIGCONT');
  }

  seek(seconds) {
    if (this.kind === 'windows-mediaplayer') {
      this.send(`seek ${seconds.toFixed(3)}`);
    } else if (this.kind === 'ffplay' || this.kind === 'mpv') {
      this.restartAt(seconds);
    }
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.kind === 'windows-mediaplayer') this.send(`volume ${volume.toFixed(3)}`);
  }

  signal(sig) {
    if (!this.child || !this.child.pid) return;
    try {
      process.kill(this.child.pid, sig);
    } catch {
      /* ignore */
    }
  }

  restartAt(seconds) {
    this.stop();
    this.startAt = seconds;
    // Give the old process a moment to release the audio device.
    const token = this.restartToken;
    setTimeout(() => {
      if (this.restartToken === token) this.start();
    }, 250);
  }

  stop() {
    this.stopped = true;
    this.restartToken = (this.restartToken || 0) + 1;
    if (this.child) {
      if (this.kind === 'windows-mediaplayer') this.send('quit');
      this.signal('SIGCONT');
      const child = this.child;
      this.child = null;
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    }
    this.alive = false;
  }
}

// ---------------------------------------------------------------- timeline

class Timeline {
  constructor(start, rate) {
    this.pos = start;
    this.playing = true;
    this.last = Date.now();
    this.rate = rate || 1;
    this.mediaSynced = false;
    this.seekGuardUntil = 0;
  }

  tick() {
    const now = Date.now();
    if (this.playing) this.pos += ((now - this.last) / 1000) * this.rate;
    this.last = now;
    return this.pos;
  }

  setPlaying(value) {
    this.tick();
    this.playing = value;
    this.last = Date.now();
  }

  seek(t) {
    this.tick();
    this.pos = t;
    this.last = Date.now();
    this.seekGuardUntil = Date.now() + 900;
  }

  sync(t) {
    this.tick();
    if (Date.now() < this.seekGuardUntil) return;
    if (t > 0.15) this.mediaSynced = true;
    if (this.mediaSynced && Math.abs(t - this.pos) > 0.7) {
      this.pos = t;
      this.last = Date.now();
    }
  }
}

// ---------------------------------------------------------------- rendering

const PALETTE = {
  title: '1;38;2;236;246;255',
  accent: '38;2;122;201;255',
  bright: '1;38;2;176;232;255',
  sung: '1;38;2;210;245;255',
  unsung: '38;2;86;126;168',
  past: '38;2;96;114;136',
  future: '38;2;78;90;108',
  dim: '38;2;110;124;144',
  faint: '38;2;66;76;92',
  rule: '38;2;38;52;70',
  warn: '38;2;255;170;120',
};

const CYAN = [92, 216, 255];
const VIOLET = [150, 126, 255];

function mixColor(a, b, f) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

// Per-character gradient (truecolor terminals only).
function gradientText(text, from, to) {
  if (!COLOR_ENABLED || !text) return text;
  const chars = Array.from(text);
  let out = '';
  chars.forEach((ch, i) => {
    const f = chars.length > 1 ? i / (chars.length - 1) : 0;
    const c = mixColor(from, to, f);
    out += `\x1b[38;2;${c[0]};${c[1]};${c[2]}m${ch}`;
  });
  return out + '\x1b[0m';
}

const WAVE_CHARS = Array.from('▁▂▃▄▅▆▇█');

function waveText(pos, playing, count) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = Math.sin(pos * 2.2 + i * 0.9) * 0.5;
    const b = Math.sin(pos * 4.1 - i * 0.55) * 0.3;
    const c = Math.sin(pos * 0.9 + i * 0.2) * 0.2;
    let v = a + b + c;
    if (!playing) v *= 0.25;
    const level = clamp(Math.round((v + 1) * 3.5), 0, WAVE_CHARS.length - 1);
    out += WAVE_CHARS[level];
  }
  return out;
}

let COLOR_ENABLED = true;

function paint(name, text) {
  if (!COLOR_ENABLED || !text) return text;
  return `\x1b[${PALETTE[name]}m${text}\x1b[0m`;
}

function isCombining(ch) {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x09bc && c <= 0x09cd) ||
    c === 0x09d7 ||
    (c >= 0x09e2 && c <= 0x09e3) ||
    c === 0x200d
  );
}

function wrapPlain(text, width) {
  const chars = Array.from(String(text).trim());
  const out = [];
  let cur = '';

  for (const ch of chars) {
    const visible = Array.from(cur.replace(/\s+$/, '')).length;
    if (visible >= width && !isCombining(ch)) {
      const space = cur.lastIndexOf(' ');
      if (space > width * 0.35) {
        out.push(cur.slice(0, space));
        cur = cur.slice(space + 1);
      } else {
        out.push(cur);
        cur = '';
      }
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.length ? out : [''];
}

function truncate(text, width) {
  const chars = Array.from(text);
  if (chars.length <= width) return text;
  return chars.slice(0, Math.max(0, width - 1)).join('') + '…';
}

function scriptLabel(mode) {
  return mode === 'banglish' ? 'Banglish lyrics' : mode === 'bengali' ? 'বাংলা লিরিক্স' : 'Banglish + বাংলা';
}

function primaryText(entry, mode) {
  if (mode === 'bengali') return entry.bengali || entry.banglish;
  return entry.banglish || entry.bengali;
}

function currentIndexAt(lines, pos) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= pos + 0.01) idx = i;
    else break;
  }
  return idx;
}

// A line should not keep wiping across a 40-second instrumental break.
// Estimate how long the words take to sing, capped by the next timestamp.
function sungDuration(entry, text) {
  const chars = Array.from(text || '').length;
  const available = Math.max(1.2, (entry.nextT || entry.t + 6) - entry.t);
  const natural = clamp(chars * 0.32 + 0.9, 2.6, 9);
  return Math.max(1.2, Math.min(natural, available));
}

function buildFrame(st) {
  const width = Math.max(36, st.cols);
  const inner = Math.max(28, width - 4);
  const textWidth = Math.max(18, inner - 4);
  const compact = st.rows < 22;
  const lines = st.lines;
  const lyricTime = st.pos + (st.sync || 0);
  const idx = currentIndexAt(lines, lyricTime);
  const rowsBudget = clamp(st.rows - 10, 3, 18);
  const out = [];

  // ------------------------------------------------------------- header
  const title = '♪  ' + SONG_TITLE.toUpperCase();
  const artist = st.artist.toUpperCase();
  out.push('');
  if (title.length + artist.length + 4 <= inner) {
    out.push('  ' + paint('title', title) + ' '.repeat(inner - title.length - artist.length) + paint('dim', artist));
  } else {
    out.push('  ' + paint('title', title));
  }
  out.push('  ' + paint('rule', '─'.repeat(inner)));

  const leftSub = `${scriptLabel(st.script)} · ${st.sourceName}`;
  const rightSub = st.sync ? `sync ${st.sync > 0 ? '+' : ''}${st.sync.toFixed(1)}s` : fmt(st.duration);
  if (leftSub.length + rightSub.length + 2 <= inner) {
    out.push('  ' + paint('faint', leftSub) + ' '.repeat(inner - leftSub.length - rightSub.length) + paint('faint', rightSub));
  } else {
    out.push('  ' + paint('faint', truncate(leftSub, inner)));
  }
  out.push('');

  // ------------------------------------------------------------- lyrics
  const past = [];
  const core = [];
  const future = [];

  // Lyrics are left-aligned on one shared column; the active line gets a
  // full-width highlight band so it still reads as the "big" line.
  const line = (text, style) => '    ' + paint(style, text);

  const band = (sung, rest) => {
    const body = sung + rest;
    const bodyLen = Array.from(body).length;
    const contentWidth = Math.max(8, inner - 2); // accent bar + one space
    const rightPad = Math.max(0, contentWidth - bodyLen);
    if (!COLOR_ENABLED) return '    ' + body;
    return (
      '  ' +
      '\x1b[48;2;11;33;50m' +
      '\x1b[1;38;2;92;216;255m▎ ' +
      '\x1b[1;38;2;234;250;255m' + sung +
      '\x1b[38;2;118;154;184m' + rest +
      ' '.repeat(rightPad) +
      '\x1b[0m'
    );
  };

  const wrapInto = (target, text, style, maxRows = 2) => {
    for (const segment of wrapPlain(text || '♪', textWidth).slice(0, maxRows)) {
      target.push(line(segment, style));
    }
  };

  if (idx < 0) {
    const first = lines[0];
    const wait = first ? Math.max(0, first.t - lyricTime) : 0;
    core.push(line(`♪  intro · first line in ${fmt(wait)}`, 'faint'));
    if (first) wrapInto(core, primaryText(first, st.script), 'future');
  } else {
    const entry = lines[idx];
    const text = primaryText(entry, st.script) || '♪';
    const span = sungDuration(entry, text);
    const singing = lyricTime <= entry.t + span + 0.25;
    const nextEntry = lines[idx + 1];
    const gap = nextEntry ? nextEntry.t - (entry.t + span) : 0;

    for (let i = Math.max(0, idx - 2); i < idx; i++) {
      wrapInto(past, primaryText(lines[i], st.script), 'past');
    }

    if (singing) {
      const progress = clamp((lyricTime - entry.t) / span, 0, 1);
      const allChars = Array.from(text);
      const cut = Math.round(progress * allChars.length);
      let cpCursor = 0;

      wrapPlain(text, textWidth).slice(0, 3).forEach((segment) => {
        const rowChars = Array.from(segment);
        // Wrap drops spaces, so walk forward until this row starts.
        while (cpCursor < allChars.length && allChars[cpCursor] !== rowChars[0]) cpCursor++;
        const start = cpCursor;
        cpCursor += rowChars.length;
        const localCut = clamp(cut - start, 0, rowChars.length);
        const sung = rowChars.slice(0, localCut).join('');
        const rest = rowChars.slice(localCut).join('');
        core.push(band(sung, rest));
      });

      if (st.script === 'both' && entry.bengali) {
        wrapInto(core, entry.bengali, 'faint');
      }
      // Only tease the next line when it is actually about to start.
      if (nextEntry && nextEntry.t - lyricTime <= 6.5) {
        wrapInto(future, primaryText(nextEntry, st.script), 'future');
      }
    } else {
      // Words are over: dim the line and let the wave carry the melody.
      wrapInto(core, text, 'past');
      if (st.script === 'both' && entry.bengali) {
        wrapInto(core, entry.bengali, 'faint');
      }

      if (nextEntry) {
        if (gap > 1.0) {
          core.push(
            line(
              truncate(`♪  instrumental · next line in ${fmt(Math.max(0, nextEntry.t - lyricTime))}`, textWidth),
              'faint'
            )
          );
        }
        if (nextEntry.t - lyricTime <= 8) {
          wrapInto(future, primaryText(nextEntry, st.script), 'future');
        }
      } else {
        core.push(line('♪  outro', 'faint'));
      }
    }
  }

  const content = [];
  let budget = rowsBudget;
  const coreRows = core.slice(0, budget);
  budget -= coreRows.length;
  const pastRows = past.slice(Math.max(0, past.length - budget));
  budget -= pastRows.length;
  const futureRows = future.slice(0, Math.max(0, budget));
  content.push(...pastRows, ...coreRows, ...futureRows);

  const padTop = Math.max(0, Math.floor((rowsBudget - content.length) / 2));
  const padBottom = Math.max(0, rowsBudget - content.length - padTop);
  for (let i = 0; i < padTop; i++) out.push('');
  out.push(...content);
  for (let i = 0; i < padBottom; i++) out.push('');

  // ------------------------------------------------------------- transport
  // One shared column: times, progress bar, wave and lyrics all line up.
  const posText = fmt(st.pos);
  const durText = fmt(st.duration);
  out.push(
    '  ' +
      paint('accent', posText) +
      ' '.repeat(Math.max(1, inner - posText.length - durText.length)) +
      paint('dim', durText)
  );

  const barWidth = Math.max(10, inner);
  const frac = st.duration > 0 ? clamp(st.pos / st.duration, 0, 1) : 0;
  const filled = Math.round(frac * barWidth);
  const empty = Math.max(0, barWidth - filled);
  let bar;
  if (filled <= 0) {
    bar = paint('bright', '●') + paint('faint', '─'.repeat(Math.max(0, barWidth - 1)));
  } else {
    const fillChars = '━'.repeat(Math.max(0, filled - 1));
    bar = gradientText(fillChars, CYAN, VIOLET) + paint('bright', '●') + paint('faint', '─'.repeat(empty));
  }
  out.push('  ' + bar);

  // Synced equalizer under the lyrics; driven by playback position and
  // freezes when paused. Right edge matches the progress bar.
  const statusPlain = st.notice
    ? truncate(st.notice, Math.max(10, inner - 20))
    : (st.finished ? 'shesh' : st.playing ? 'playing' : 'paused') +
      (width >= 68 ? ` · vol ${Math.round(st.volume * 100)}%` : '');
  const statusIcon = st.notice ? '' : st.finished ? '⏹ ' : st.playing ? '⏵ ' : '⏸ ';
  const statusLen = Array.from(statusIcon + statusPlain).length;
  const status = st.notice
    ? paint('warn', statusPlain)
    : paint(st.playing && !st.finished ? 'accent' : 'warn', `${statusIcon}${statusPlain}`);
  const waveCount = clamp(inner - statusLen - 3, 12, 48);
  const wave = waveText(st.pos, st.playing && !st.finished, waveCount);
  const waveStyled = st.playing && !st.finished ? gradientText(wave, CYAN, VIOLET) : paint('faint', wave);
  const waveGap = Math.max(3, inner - waveCount - statusLen);
  out.push('  ' + waveStyled + ' '.repeat(waveGap) + status);

  out.push('');
  const keys = width < 50
    ? 'space · ←/→ · ↑/↓ · q'
    : compact
      ? 'space pause · ←/→ seek · ↑/↓ vol · q quit'
      : width < 82
        ? 'space pause · ←/→ seek · ↑/↓ vol · s script · [ ] sync · q quit'
        : 'space pause · ←/→ seek 5s · ↑/↓ volume · s script · [ ] sync · r restart · q quit';
  out.push('  ' + paint('faint', truncate(keys, inner)));

  return out.map((line) => line + '\x1b[K').join('\n');
}


// ---------------------------------------------------------------- plain mode

function runPlain(st) {
  let lastIdx = -2;
  let lastState = null;
  let endPrinted = false;
  let lastMelody = -2;

  return function render() {
    const t = st.pos + (st.sync || 0);
    const idx = currentIndexAt(st.lines, t);

    if (lastState !== st.playing) {
      if (lastState !== null) {
        console.log(`${st.playing ? '▶' : '⏸'} ${fmt(st.pos)}  ${st.playing ? 'playing' : 'paused'}`);
      }
      lastState = st.playing;
    }

    if (idx !== lastIdx) {
      if (idx >= 0) {
        const entry = st.lines[idx];
        const text = primaryText(entry, st.script);
        console.log(`[${fmt(entry.t)}] ${text}`);
        if (st.script === 'both' && entry.bengali) console.log(`         ${entry.bengali}`);
      }
      lastIdx = idx;
    }

    // Announce instrumental stretches once instead of leaving a stale line.
    if (idx >= 0 && idx !== lastMelody) {
      const entry = st.lines[idx];
      const span = sungDuration(entry, primaryText(entry, st.script));
      const next = st.lines[idx + 1];
      if (next && t > entry.t + span + 0.4 && next.t - (entry.t + span) > 1) {
        console.log(`[${fmt(t)}] ♪ instrumental…`);
        lastMelody = idx;
      }
    }

    if (!endPrinted && st.finished) {
      console.log('');
      console.log('— shesh —');
      endPrinted = true;
    }
  };
}

// ---------------------------------------------------------------- main

function printHelp() {
  console.log(`Neelanjana — terminal music player with synced Banglish lyrics

Usage:
  node neelanjana.js [options]

Options:
  -f, --file <path>      audio/video file      (default: Neelanjana.mp4)
  -l, --lrc <path>       banglish lyric file   (default: Neelanjana.banglish.lrc)
      --script <mode>    banglish | bengali | both   (default: banglish)
  -s, --start <time>     start position, 1:24 or 84  (default: 0)
  -v, --volume <0-100>   playback volume        (default: 85)
      --sync <seconds>   lyric offset: + makes lyrics late, - early (default: 0)
      --demo             lyrics only, no audio
      --no-color         disable colors
      --plain            scrolling lyrics, no full-screen UI
  -h, --help             show this help
      --version          show version

Keys (interactive mode):
  space pause/resume · ←/→ seek 5s · ↑/↓ volume · s switch script
  [ / ] nudge lyrics earlier/later · r restart · q quit

Examples:
  node neelanjana.js
  node neelanjana.js --start 1:06 --script both
  node neelanjana.js -s 2:56 --volume 60`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) return printHelp();
  if (opts.version) return console.log('neelanjana 1.0.0');

  const audioPath = resolveFile(opts.audio, DEFAULT_AUDIO, ROOT);
  if (!opts.demo && !audioPath) {
    die('no audio file found (expected Neelanjana.mp4). Use --file <path> or --demo.');
  }

  const banglishPath = opts.lrc
    ? resolveFile(opts.lrc, [], ROOT)
    : resolveFile(null, DEFAULT_LRC, ROOT);
  if (!banglishPath) die('no lyric file found (expected Neelanjana.banglish.lrc)');

  // The bengali file is optional; it is only used for --script bengali/both.
  let bengaliPath = null;
  for (const candidate of ['Encore - Neelanjana.lrc', 'Neelanjana.bengali.lrc']) {
    const p = path.resolve(ROOT, candidate);
    if (fs.existsSync(p)) {
      bengaliPath = p;
      break;
    }
  }

  const song = loadSong(banglishPath, bengaliPath);
  if (!song.lines.length) die(`no timed lyrics found in ${banglishPath}`);
  const hasBengali = song.lines.some((line) => line.bengali);
  if (!hasBengali) opts.script = 'banglish';

  // YouTube-style mp4 files often carry AV1 video that Windows cannot decode,
  // which makes MediaPlayer refuse the whole file. Pull the AAC track out once
  // and play that instead.
  let playPath = audioPath;
  let extracted = null;
  if (!opts.demo && audioPath && /\.(mp4|m4v|mov)$/i.test(audioPath)) {
    try {
      extracted = extractAudio(audioPath);
      playPath = extracted.file;
    } catch (err) {
      if (process.env.NEELANJANA_DEBUG) {
        console.error(`neelanjana: audio extract failed: ${err.message}`);
      }
    }
  }

  const duration =
    (extracted && extracted.duration) ||
    mediaDuration(playPath || '') ||
    (song.meta.length ? parseTime(song.meta.length) : 0) ||
    song.lines[song.lines.length - 1].t + 12;

  const tty = Boolean(process.stdout.isTTY) && !opts.plain;
  COLOR_ENABLED =
    opts.color &&
    !process.env.NO_COLOR &&
    (tty || Boolean(process.env.FORCE_COLOR));

  const rate = opts.demo && process.env.NEELANJANA_SPEED
    ? Math.max(0.1, Number(process.env.NEELANJANA_SPEED) || 1)
    : 1;

  const state = {
    lines: song.lines,
    pos: opts.start,
    duration,
    playing: true,
    finished: false,
    hasBengali,
    volume: opts.volume,
    sync: opts.sync,
    script: opts.script,
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
    sourceName: opts.demo || !audioPath ? 'demo (no audio)' : path.basename(audioPath),
    artist: song.meta.ar || ARTIST,
    notice: '',
  };

  const timeline = new Timeline(opts.start, rate);
  let player = null;

  if (!opts.demo) {
    player = new Player(playPath, { start: opts.start, volume: opts.volume });
    player
      .on('ready', () => {
        state.notice = '';
      })
      .on('error', (message) => {
        state.notice = `audio: ${message} — lyrics only`;
      })
      .on('warning', (message) => {
        state.notice = `audio: ${message}`;
        setTimeout(() => {
          if (state.notice === `audio: ${message}`) state.notice = '';
        }, 4000);
      })
      .on('position', (pos) => {
        timeline.sync(pos);
      });
    player.start();
  }

  // ------------------------------------------------------------ terminal setup

  const stdin = process.stdin;
  let cleanedUp = false;
  let renderTimer = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (renderTimer) clearInterval(renderTimer);
    if (player) player.stop();
    if (tty) {
      process.stdout.write('\x1b[?25h\x1b[?1049l');
      if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(false);
      stdin.pause();
      if (state.syncChanged && state.sync !== 0) {
        console.log(
          `lyrics sync ${state.sync > 0 ? '+' : ''}${state.sync.toFixed(2)}s — keep it with: node neelanjana.js --sync ${state.sync}`
        );
      }
    }
  };

  const quit = () => {
    cleanup();
    process.exit(0);
  };

  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);
  process.on('exit', cleanup);
  process.stdout.on('error', (err) => {
    if (err && err.code === 'EPIPE') quit();
  });

  const seekTo = (target) => {
    const t = clamp(target, 0, Math.max(0, duration));
    timeline.seek(t);
    state.pos = t;
    if (player) player.seek(t);
  };

  const togglePlay = () => {
    timeline.setPlaying(!timeline.playing);
    state.playing = timeline.playing;
    if (player) {
      if (timeline.playing) player.resume();
      else player.pause();
    }
  };

  const changeVolume = (delta) => {
    state.volume = clamp(state.volume + delta, 0, 1);
    if (player) player.setVolume(state.volume);
    state.notice = `volume ${Math.round(state.volume * 100)}%`;
    setTimeout(() => {
      if (state.notice.startsWith('volume')) state.notice = '';
    }, 1400);
  };

  const cycleScript = () => {
    const order = state.hasBengali ? ['banglish', 'bengali', 'both'] : ['banglish'];
    if (order.length === 1) return;
    state.script = order[(order.indexOf(state.script) + 1) % order.length];
    state.notice = `${scriptLabel(state.script)}`;
    setTimeout(() => {
      if (state.notice === scriptLabel(state.script)) state.notice = '';
    }, 1400);
  };

  const nudgeSync = (delta) => {
    state.sync = clamp(Number((state.sync + delta).toFixed(2)), -30, 30);
    state.syncChanged = true;
    state.notice = `lyrics ${state.sync >= 0 ? '+' : ''}${state.sync.toFixed(2)}s  (--sync ${state.sync})`;
    setTimeout(() => {
      if (state.notice.startsWith('lyrics ')) state.notice = '';
    }, 1800);
  };

  if (tty) {
    if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', (key) => {
      if (key === '\u0003' || key === 'q' || key === 'Q' || key === '\u001b') return quit();
      if (key === ' ') return togglePlay();
      if (key === '\u001b[D') return seekTo(timeline.pos - 5);
      if (key === '\u001b[C') return seekTo(timeline.pos + 5);
      if (key === '\u001b[A') return changeVolume(0.1);
      if (key === '\u001b[B') return changeVolume(-0.1);
      if (key === 's' || key === 'S') return cycleScript();
      if (key === '[') return nudgeSync(-0.2);
      if (key === ']') return nudgeSync(0.2);
      if (key === 'r' || key === 'R') return seekTo(0);
    });

    process.stdout.on('resize', () => {
      state.cols = process.stdout.columns || 80;
      state.rows = process.stdout.rows || 24;
    });

    process.stdout.write('\x1b[?1049h\x1b[2J\x1b[?25l');
  }

  // ------------------------------------------------------------ render loop

  let lastFrame = '';
  const plainRender = tty ? null : runPlain(state);

  const render = () => {
    if (cleanedUp) return;
    state.pos = timeline.tick();
    state.playing = timeline.playing;

    const done = duration > 0 && state.pos >= duration - 0.25;
    state.finished = done;
    if (done && timeline.playing) {
      timeline.setPlaying(false);
      state.playing = false;
      if (player) player.pause();
    }

    if (plainRender) {
      plainRender();
      if (state.pos > duration + 1) quit();
      return;
    }

    const frame = buildFrame(state);
    if (frame !== lastFrame) {
      process.stdout.write('\x1b[H' + frame + '\x1b[0J');
      lastFrame = frame;
    }
  };

  if (!tty) {
    // Header once, then one line per lyric; nice for pipes and logs.
    console.log(`♪ ${SONG_TITLE} — ${state.artist}`);
    console.log(`${scriptLabel(state.script)} · ${fmt(duration)} · ${state.sourceName}`);
    console.log('');
  }

  renderTimer = setInterval(render, 100);
  render();

  if (opts.demo && !tty) {
    const deadline = Date.now() + ((duration - opts.start) / rate + 2) * 1000;
    const check = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(check);
        quit();
      }
    }, 200);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`neelanjana: ${err && err.message ? err.message : err}`);
    process.exit(1);
  });
} else {
  module.exports = { parseLrc, loadSong, buildFrame, wrapPlain, fmt, parseTime, Player };
}
