# SealPad (印台)

An offline, open-source tool for stamping seals and signatures onto PDFs. Everything is processed locally — no uploads, no account.

[简体中文](README.md) · English

## Features

- **Real-size stamping** — pages and seals are measured in millimetres, so a 42 mm company seal prints at 42 mm. Drag, resize, rotate, nudge with arrow keys, or type exact values.
- **Cross-page (straddle) seals** — left or right edge, page range, skip cover, odd pages only for duplex printing, vertical position, and grouping for long documents. The seal image is actually sliced on export, so each page only contains its own strip.
- **Seal library** — import scans or photos; the white background is removed and margins are cropped automatically. Stored on this device only.
- **Stamp every page** at the same position with one click.
- **Web and desktop** — one UI. The web version runs entirely in the browser; the desktop app (Windows / macOS / Linux, built with Tauri 2) adds native file dialogs now, and phone-based handwritten signatures, Word import and digital signatures later.

## Use it

- Web: https://jiangcuo.github.io/sealpad/
- Desktop: [Releases](https://github.com/jiangcuo/sealpad/releases) (installers are not code-signed yet)

## Please note

1. Only create and use seals and signatures you are authorised to use.
2. Placing a seal image on a PDF is **not** a legally binding electronic signature. Certificate-based PAdES signing is on the roadmap.
3. SealPad never connects to the network and collects no data.

## Development

Requires Node.js 22.13+ and pnpm 10; the desktop app also needs Rust stable and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm dev            # web dev server
pnpm test           # core unit tests
pnpm build          # build the web app
pnpm desktop:dev    # run the desktop app
```

See [docs/design.md](docs/design.md) (Chinese) for architecture and roadmap.

## License

[Apache-2.0](LICENSE)
