# 🎵 Neelanjana — Terminal Music Player

A lightweight, zero-dependency terminal music player for **Encore's Neelanjana**, featuring synchronized Bangla and Banglish lyrics, keyboard controls, audio playback, and real-time lyric synchronization.

Built using **Node.js**, with no npm packages or complicated installation process.

## ✨ Features

- 🎧 Play Neelanjana directly from your terminal.
- 🎤 Real-time synchronized LRC lyrics.
- 🌐 Switch between Bangla, Banglish, and bilingual lyrics.
- ⏯️ Pause, resume, restart, and seek audio using your keyboard.
- 🔊 Adjust playback volume.
- ⏱️ Fine-tune lyric synchronization in real time.
- 🎨 Colored terminal interface.
- 🎼 Automatic instrumental-section detection using lyric timing.
- 📦 Zero npm dependencies.
- 🖥️ Support for Windows, Linux, and macOS with an available compatible playback engine.
- 🛠️ Demo mode for testing lyrics without audio.

---

## 📋 System Requirements

Before running Neelanjana, make sure your system meets these requirements.

| Requirement | Details |
|---|---|
| Runtime | Node.js |
| Package Manager | Not required |
| Terminal | VS Code Terminal, PowerShell, CMD, or a compatible terminal |
| Operating System | Windows, Linux, macOS |
| Internet | Required for initial download only |
| npm Dependencies | None |

### Audio Engine Requirements

**Windows**

Uses the built-in Windows Media Player functionality through PowerShell.

- No external audio player installation is normally required.
- Supports playback, seeking, pausing, and volume controls.
- Can extract the AAC audio track from the supplied MP4 when required.

**Linux**

Requires a compatible audio player such as `ffplay` or `mpv`.

**macOS**

Uses an available supported audio engine, including `ffplay`, `mpv`, or `afplay`.

If no supported audio engine is available, the application can continue in lyrics-only mode.

---

## 🚀 Installation Guide

### Step 1 — Install Node.js

First, install Node.js from the official website:

https://nodejs.org/

Download and install the recommended LTS version.

After installation, open your terminal and check:

```bash
node --version
```

Expected example output:

```text
v24.x.x
```

The exact version depends on your installation.

You can also check npm:

```bash
npm --version
```

**Note:** npm is not needed to run Neelanjana. This command only verifies the Node.js installation.

### Step 2 — Download the Project

You can download the project using Git or as a ZIP archive.

**Method A: Clone using Git (Recommended)**

Open a terminal and run:

```bash
git clone https://github.com/cathaxor/Neelanjana.git
```

Enter the downloaded project directory:

```bash
cd Neelanjana
```

**Method B: Download ZIP**

1. Open the GitHub repository: https://github.com/cathaxor/Neelanjana
2. Click the green **Code** button.
3. Select **Download ZIP**.
4. Extract the ZIP archive.
5. Open the extracted folder in VS Code.

Make sure the project includes its JavaScript files, lyric files, and required audio source.

### Step 3 — Open the Project in VS Code

1. Launch Visual Studio Code.
2. Select **File → Open Folder**.
3. Select the `Neelanjana` project directory.
4. Open **Terminal → New Terminal**.
5. Verify that the terminal is opened inside the project directory.

For example, on Windows:

```powershell
PS D:\Neelanjana>
```

If necessary, navigate manually:

```powershell
cd D:\Neelanjana
```

### Step 4 — Run Neelanjana

Execute:

```bash
node neelanjana.js
```

The terminal player will start, initialize the available audio engine, and display synchronized lyrics during playback.

**Important:** Keep the terminal open while the music is playing.

---

## ⚡ Quick Start Commands

### Windows (PowerShell)

Navigate to the project directory:

```powershell
cd D:\Neelanjana
```

Start the music player:

```powershell
node .\neelanjana.js
```

Alternatively, use the Windows launcher:

```powershell
.\play.cmd
```

### Windows (Command Prompt)

```bat
cd /d D:\Neelanjana
node neelanjana.js
```

Or:

```bat
play.cmd
```

### Linux

Open your terminal and navigate to the project directory:

```bash
cd ~/Neelanjana
```

Run:

```bash
node neelanjana.js
```

Alternatively:

```bash
bash play.sh
```

### macOS

Open Terminal and navigate to the project directory:

```bash
cd ~/Neelanjana
```

Run:

```bash
node neelanjana.js
```

Or:

```bash
bash play.sh
```

**Note:** The paths above are examples. Use the actual directory where you downloaded the project.

---

## 🎶 Playback Examples

### 1. Standard Playback

Play the song from the beginning:

```bash
node neelanjana.js
```

### 2. Skip the Intro

Neelanjana begins with an approximately 35-second introduction.

To start near the first vocal section:

```bash
node neelanjana.js --start 0:30
```

### 3. Start at a Specific Timestamp

Start playback at 1 minute and 24 seconds:

```bash
node neelanjana.js --start 1:24
```

Or provide the timestamp in seconds:

```bash
node neelanjana.js --start 84
```

### 4. Show Bangla Lyrics

```bash
node neelanjana.js --script bengali
```

### 5. Show Banglish Lyrics

```bash
node neelanjana.js --script banglish
```

### 6. Display Both Languages

```bash
node neelanjana.js --script both
```

### 7. Set Playback Volume

For example, start with 60% volume:

```bash
node neelanjana.js --volume 60
```

Volume values range from 0 to 100.

### 8. Adjust Lyrics Synchronization

If the lyrics appear too early or too late, configure a synchronization offset:

```bash
node neelanjana.js --sync 0.5
```

A positive offset delays the lyrics.

```bash
node neelanjana.js --sync -0.5
```

A negative offset displays the lyrics earlier.

### 9. Run Without Audio

Test the synchronized lyrics without music playback:

```bash
node neelanjana.js --demo
```

### 10. Plain Text Mode

For a simpler scrolling lyric output:

```bash
node neelanjana.js --plain
```

### 11. Disable Terminal Colors

```bash
node neelanjana.js --no-color
```

### 12. Use a Custom Audio File

```bash
node neelanjana.js --file "song.mp4"
```

### 13. Use a Custom Lyrics File

```bash
node neelanjana.js --lrc "custom.lrc"
```

Ensure the referenced files exist and use compatible formats.

---

## 🎮 Keyboard Controls

The following keys can be used while the terminal player is running.

| Key | Action | Description |
|---|---|---|
| `Space` | Pause / Resume | Toggle audio playback |
| `←` | Seek backward | Move backward by 5 seconds |
| `→` | Seek forward | Move forward by 5 seconds |
| `↑` | Volume up | Increase playback volume |
| `↓` | Volume down | Decrease playback volume |
| `S` | Switch lyrics | Cycle between Banglish, Bangla, and both |
| `[` | Earlier lyrics | Shift lyrics 0.2 seconds earlier |
| `]` | Later lyrics | Shift lyrics 0.2 seconds later |
| `R` | Restart | Restart playback from the beginning |
| `Q` | Quit | Exit the player |

**Tip:** Keep the terminal focused while using keyboard shortcuts.

---

## ⚙️ Command-Line Arguments

Neelanjana supports configurable command-line options.

| Option | Description | Default |
|---|---|---|
| `-f, --file <path>` | Audio or video source file | `Neelanjana.mp4` |
| `-l, --lrc <path>` | Synchronized lyric file | `Neelanjana.banglish.lrc` |
| `--script <mode>` | `banglish`, `bengali`, or `both` | Player default |
| `-s, --start <time>` | Starting playback timestamp | Beginning |
| `-v, --volume <0-100>` | Playback volume | `85` |
| `--sync <seconds>` | Lyrics synchronization offset | `0` |
| `--demo` | Simulate lyric playback without audio | Disabled |
| `--plain` | Enable scrolling plain-text lyric output | Disabled |
| `--no-color` | Disable colored terminal output | Disabled |

### Combining Options

Multiple arguments can be combined in a single command.

Example:

```bash
node neelanjana.js --script both --start 0:30 --volume 75
```

This starts playback after the introduction, sets the volume to 75%, and displays both lyric scripts.

Another example:

```bash
node neelanjana.js --script bengali --sync -0.3 --no-color
```

This enables Bangla lyrics, shifts their display earlier by 0.3 seconds, and disables terminal colors.

---

## 🎧 How the Audio Engine Works

### Windows Audio Playback

On Windows, Neelanjana uses a PowerShell-based Windows Media Player integration.

The playback engine is located at:

```text
players/win-mediaplayer.ps1
```

The player provides basic playback management, including:

- Starting audio playback.
- Pausing and resuming.
- Seeking through the song.
- Changing playback volume.

### Automatic AAC Extraction

Some MP4 files contain AV1 video streams, which may not be supported by the Windows playback engine.

To handle this, Neelanjana includes:

```text
mp4-audio.js
```

When required, this script extracts the existing AAC audio track from the MP4 container.

The extracted audio is stored as:

```text
Neelanjana.audio.aac
```

This process does not require installing ffmpeg.

The extracted file can be reused on subsequent runs.

### Linux and macOS Playback

On Linux and macOS, the player attempts to use an available compatible external audio engine.

Supported player options include:

- `ffplay`
- `mpv`
- `afplay` where available

For example, Linux users can install mpv using their distribution's package manager.

Ubuntu or Debian:

```bash
sudo apt update
sudo apt install mpv
```

macOS users with Homebrew can install mpv:

```bash
brew install mpv
```

If a compatible audio player cannot be found, Neelanjana displays a notice and continues in lyrics-only mode.

---

## 📝 Synchronized Lyrics System

Neelanjana uses the LRC lyric format.

Each lyric line is associated with a timestamp that determines when it appears during playback.

Example format:

```text
[00:35.00]Example lyric line
[00:40.50]Another lyric line
[00:45.00]Next lyric line
```

The player continuously matches the current playback position with the timestamps in the LRC file.

### Supported Lyric Modes

**Banglish**

Displays Bengali lyrics using Latin characters.

**Bangla**

Displays Bengali lyrics using the Bengali script.

**Both**

Displays both forms together.

Press `S` during playback to switch between modes.

### Instrumental Sections

When the music enters an instrumental section, the player avoids keeping the previous lyric line highlighted indefinitely.

Instead, the line becomes dimmed and the player can display an instrumental countdown:

```text
♪ instrumental · next line in 0:xx
```

This provides a clearer indication of upcoming lyrics.

### Live Synchronization Adjustment

If lyrics are not perfectly synchronized with the audio, press:

```text
[    Shift lyrics earlier by 0.2 seconds
]    Shift lyrics later by 0.2 seconds
```

You can also set the synchronization offset before launching the player using `--sync`.

---

## 📁 Project Structure

```text
Neelanjana/
│
├── neelanjana.js
│   └── Main terminal music player
│
├── mp4-audio.js
│   └── Dependency-free MP4 AAC extraction
│
├── Neelanjana.banglish.lrc
│   └── Timestamped Banglish lyrics
│
├── Encore - Neelanjana.lrc
│   └── Original Bangla lyrics
│
├── Neelanjana.mp4
│   └── Song audio/video source
│
├── Neelanjana.audio.aac
│   └── Auto-generated extracted AAC audio
│
├── players/
│   └── win-mediaplayer.ps1
│       └── Windows playback engine
│
├── play.cmd
│   └── Windows launcher
│
├── play.sh
│   └── Linux / macOS launcher
│
└── README.md
    └── Project documentation
```

The extracted `.aac` file may not exist until the audio extraction process runs for the first time.

---

## 🛠️ Troubleshooting

### Problem 1: `'node' is not recognized`

**Cause:** Node.js is missing or not available in the system PATH.

**Solution:**

1. Install Node.js from https://nodejs.org/.
2. Restart VS Code.
3. Open a new terminal.
4. Execute:

```bash
node --version
```

If a version number appears, try launching the player again.

### Problem 2: `Cannot find module`

**Cause:** The terminal is opened in the wrong directory, or a required JavaScript file is missing.

**Solution:**

On Windows:

```powershell
cd D:\Neelanjana
```

Check the files:

```powershell
dir
```

Then run:

```powershell
node neelanjana.js
```

### Problem 3: Music Is Not Playing

Possible causes include:

- Unsupported audio format.
- Missing playback engine.
- Missing audio file.
- Audio device or output configuration problems.

**Solution:**

Confirm that the audio file exists.

On Windows:

```powershell
dir Neelanjana.mp4
```

On Linux or macOS:

```bash
ls -l Neelanjana.mp4
```

Make sure your system can play the supplied audio file and that an appropriate playback engine is available.

### Problem 4: Lyrics Are Not Synchronized

**Solution:**

Use the keyboard controls:

```text
[  Earlier
]  Later
```

Alternatively:

```bash
node neelanjana.js --sync -0.5
```

Adjust the offset until the displayed lyrics match the audio.

### Problem 5: Bengali Text Is Not Displayed Correctly

**Solution:**

1. Use a terminal with Unicode support.
2. Select a font with Bengali glyph support.
3. Ensure the LRC file is saved in UTF-8 encoding.
4. Restart the terminal if necessary.

VS Code's integrated terminal is recommended.

### Problem 6: PowerShell Script Execution Fails

Check whether PowerShell is available and whether execution policies are restricting script execution.

On Windows, inspect the current policy:

```powershell
Get-ExecutionPolicy -List
```

Review the relevant policy before making any system-level changes.

Avoid disabling PowerShell security protections globally just to run the music player.

### Problem 7: Terminal Displays Lyrics but No Audio

The application may have entered lyrics-only mode because no supported playback engine was available.

Install or configure an appropriate audio player and restart Neelanjana.

---

## 🔄 Updating the Project

If you cloned Neelanjana from GitHub, you can retrieve future changes using:

```bash
git pull origin main
```

Then restart the application:

```bash
node neelanjana.js
```

If you downloaded the project as a ZIP archive, download a newer archive and replace the relevant project files.

---

## 💡 Tips and Best Practices

- Use VS Code's integrated terminal for a convenient experience.
- Start near `0:30` to skip most of the introduction.
- Use `--script both` when you want both Bangla and Banglish lyrics.
- Adjust lyric synchronization using `[` and `]`.
- Use `--demo` to test lyric timing without audio.
- Keep audio and lyric files in the expected locations.
- Use headphones for a better listening experience.
- Check file paths when running the player from a different directory.

---

## 👨‍💻 Developer

**Abdur Rahaman Abdulla (CatHaxor)**

- GitHub: https://github.com/cathaxor
- Website: https://cathaxor.com
- Developer Website: https://cathaxor.dev
- YouTube: Abdulla Tech 49
- Instagram: https://www.instagram.com/abdulla_trzz/

### Repository

https://github.com/cathaxor/Neelanjana

---

## ⚖️ Music and Copyright Notice

**Neelanjana** is a song by **Encore**.

All rights to the original song, audio, composition, and associated copyrighted content belong to their respective copyright holders.

This repository is an independent terminal music player project and does not claim ownership of the original music.

If distributing this repository publicly, ensure that any included audio, video, or lyric files are shared with the appropriate permissions or licenses.

---

## ⭐ Support the Project

If you find Neelanjana Terminal Music Player useful, consider giving the GitHub repository a star.

**Made with ❤️ by CatHaxor**

Enjoy music directly from your terminal! 🎵