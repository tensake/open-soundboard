<p align="center">
  <img src="https://10ku.net/osb/logo.png" alt="Open SoundBoard logo" height="300" />
</p>

[![Tauri](https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=fff)](https://tauri.app/)
[![Solid](https://img.shields.io/badge/Solid-2C4F7C?logo=solid&logoColor=fff)](https://www.solidjs.com/)
[![Rust](https://img.shields.io/badge/Rust-%23000000.svg?e&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/github/actions/workflow/status/tensake/open-soundboard/test.yml)](https://github.com/tensake/open-soundboard/actions)
[![Release](https://img.shields.io/github/v/release/tensake/open-soundboard)](https://github.com/tensake/open-soundboard/releases)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/tensake/open-soundboard)

A fast, cross-platform and lightweight soundboard built with Rust and Tauri.
Currently, supports Windows and Linux. Has hotkeys support, app forwarding, and
customisation.

> [!note] Status
> The soundboard is still in development and may not work as expected. Please report any issues you encounter.

## Preview

| ![Dashboard](https://10ku.net/osb/demo/open-soundboard_v0.1.0-dashboard.jpg) | ![App Forwarding](https://10ku.net/osb/demo/open-soundboard_v0.1.0-app_forwarding.jpg) |
| --- | --- |
| ![Settings](https://10ku.net/osb/demo/open-soundboard_v0.1.0-settings.jpg) | _More features coming soon_ |

## Features

| Feature | Windows | Linux |
| --- | --- | --- |
| Sound Playback | ✅ | ✅ |
| App forwarding | ✅ | 🔧 |
| Hotkeys | ✅ | ✅ |

## How to install

### Requirements

- For windows you need to have [VB Virtual Audio Cable](https://vb-audio.com/Cable/) installed (after installation please restart your computer).

### Steps

1. Download the latest release for your platform from the [releases page](https://github.com/tensake/open-soundboard/releases).
2. Run the binary to install the app on your system.
3. Once installed, configure the soundboard, and make sure you pick the virtual cable device as input device in the app you want to use it in. For example, in discord you need to pick `VB Cable` if on windows, or `Open Soundboard` if on linux as an input device in the `Voice and Video` setting in discord. Also disable noise cancelling if you have it by setting `Input Profile` to `Studio`.
4. For windows, you need to choose your default output audio correctly in the `Windows Settings` as this is the device to which the sound is played to. And also make sure microphone is selected correctly too.
5. Done!

## Build

### Steps to build

1. Clone the repository:

   ```bash
   git clone https://github.com/tensake/open-soundboard.git
   cd open-soundboard
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Build the project:

    ```bash
    npm run tauri build
    ```

## Contributing

Contributions are welcome!
Please submit a pull request or open an issue if you want to contribute.
