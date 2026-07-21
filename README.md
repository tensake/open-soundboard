<p align="center">
  <img 
    src="https://10ku.net/osb/thumbnail.png" 
    alt="Open SoundBoard thumbnail" 
    height="300" 
    style="border-radius: 32px;" />
</p>

[![Tauri](https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=fff)](https://tauri.app/)
[![Solid](https://img.shields.io/badge/Solid-2C4F7C?logo=solid&logoColor=fff)](https://www.solidjs.com/)
[![Rust](https://img.shields.io/badge/Rust-%23000000.svg?e&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/github/actions/workflow/status/tensake/open-soundboard/test.yml)](https://github.com/tensake/open-soundboard/actions)
[![Release](https://img.shields.io/github/v/release/tensake/open-soundboard)](https://github.com/tensake/open-soundboard/releases)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/tensake/open-soundboard)

> [!WARNING]
> The soundboard is still in development and may not work as expected. Please report any issues you encounter.

## Preview

| ![Dashboard](https://10ku.net/osb/demo/open-soundboard_dashboard.jpg) | ![App Forwarding](https://10ku.net/osb/demo/open-soundboard_app-forwarding.jpg) |
| --- | --- |
| ![Settings](https://10ku.net/osb/demo/open-soundboard_settings-sound.jpg) | ![Hotkeys](https://10ku.net/osb/demo/open-soundboard_settings-hotkeys.jpg) |

## How to install

### Requirements

#### Windows

You need to have [VB Virtual Audio Cable](https://vb-audio.com/Cable/) installed (after installation please restart your computer).

#### Linux

PipeWire or PulseAudio is required (this is installed on most Linux distros by default).

### Steps

1. Download the latest release for your platform from the [releases page](https://github.com/tensake/open-soundboard/releases).
2. Run the downloaded setup binary to install the app on your system.
3. Once installed, configure the soundboard, and make sure you pick the virtual cable device as input device in the app you want to use it in.

   > For example, in discord, go to Settings > `Voice and Video` and pick `VB Cable` or `Open Soundboard` as an input device. Also disable noise cancelling if you have it by setting `Input Profile` to `Studio` so that the sounds you play wont be filtered.

4. Choose your default input and output audio correctly in the system settings as these devices will be used.
5. Done!

## Features

| Feature                               | Windows | Linux       |
| ------------------------------------- | ------- | ----------- |
| App forwarding                        | ✅      | In progress |
| Hotkeys                               | ✅      | X11 only    |
| Sound Playback and all other features | ✅      | ✅          |

## Build from source

### Requirements

- [bun](https://bun.sh/) (or [npm](https://nodejs.org/en/download))
- [cargo](https://rustup.rs/)

### Steps to build

1. Clone the repository:

   ```bash
   git clone https://github.com/tensake/open-soundboard.git
   cd open-soundboard
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Build the project:

   ```bash
   bun tauri build
   ```

## Contributing

Contributions are welcome!
Please submit a pull request or open an issue if you want to contribute.
