# Neelanjana — terminal music player

Encore-er *Neelanjana* jonno chhoto ekta terminal player: mp4 theke audio bajay,
ar LRC timing onujayi **Banglish lyrics** screen e sync kore. Kono npm package lage na.

## Chalao

VS Code terminal khule `D:\Neelanjana` folder e jao, tarpor:

```bash
node neelanjana.js
```

Ba shortcut:

```bash
.\play.cmd          # Windows / PowerShell / cmd
./play.sh           # macOS / Linux
```

Song shuru te 00:35 porjonto intro, tai shuru tei lyric dekhte chan?:

```bash
node neelanjana.js --start 0:30
```

## Controls

| Key | Kaj |
| --- | --- |
| `space` | pause / resume |
| `←` `→` | 5 second seek |
| `↑` `↓` | volume |
| `s` | Banglish → Bangla → both |
| `[` `]` | lyrics 0.2s early / late (sync nudge) |
| `r` | shuru theke abar |
| `q` | ber hoye jao |

## Options

```
-f, --file <path>      audio/video file      (default: Neelanjana.mp4)
-l, --lrc <path>       lyric file            (default: Neelanjana.banglish.lrc)
    --script <mode>    banglish | bengali | both
-s, --start <time>     1:24 ba 84
-v, --volume <0-100>   volume               (default: 85)
    --sync <seconds>   lyric offset: + late, - early (default: 0)
    --demo             audio chara, shudhu lyrics
    --plain            scrolling lyrics (pipe/log er jonno)
    --no-color         color bondho
```

## Audio engine

- **Windows:** built-in Windows MediaPlayer (PowerShell) — ffmpeg lagbe na.
  Pause/seek/volume shob kaj kore.
- mp4 er vitore AV1 video thakle Windows seta decode korte pare na, tai CLI
  prothom bar AAC audio track ta `Neelanjana.audio.aac` e ber kore niye seta bajay.
- **Linux/macOS:** `ffplay` ba `mpv` pele setai use hoy, nahole `afplay`.
- Kono player na paoa gele lyrics-only mode e chole, screen e notice dekhay.
- Instrumental/melody er somoy purono line stuck thake na: line ta dim hoye
  `♪ instrumental · next line in 0:xx` dekhabe. `[` `]` diye live sync adjust korte paro.

## Files

```
neelanjana.js            CLI
mp4-audio.js             mp4 theke AAC track ber kore (zero dependency)
Neelanjana.banglish.lrc  synced Banglish lyrics
Encore - Neelanjana.lrc  original Bangla lyrics
Neelanjana.mp4           audio source
Neelanjana.audio.aac     auto-generated audio track (prothom run e toiri hoy)
players/win-mediaplayer.ps1  Windows audio engine
```
