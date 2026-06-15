# Music Presence

Music Presence is a Windows tray app that shows the current Apple Music track as Discord Rich Presence.

It reads local playback state from Windows System Media Transport Controls (SMTC) and talks to the local Discord desktop client through Discord RPC. It does not use an Apple account, Apple Music API, Discord bot token, backend service, analytics, or telemetry.

## Status

This repository is ready for development and packaging. Public builds include a maintainer-owned Discord Developer Application client ID so users can run the app without creating a config file.

The client ID is not a secret. Do not commit Discord application secrets or tokens.

## User Install

1. Download the latest Windows installer or portable EXE from GitHub Releases.
2. Start Music Presence.
3. Start Discord desktop.
4. Play music in the Apple Music Windows app.

The tray menu shows the current status, a reconnect command, a clear activity command, an autostart toggle, and quit.

Unsigned builds may trigger Windows SmartScreen. Code signing can be added later.

## Development

Requirements:

- Windows 10 1809 or later.
- Node.js 20 or later.
- Discord desktop for manual Rich Presence testing.
- Apple Music for Windows for end-to-end media testing.

PowerShell may block `npm.ps1`; use `npm.cmd`.

```powershell
npm.cmd install
npm.cmd run generate:icon
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run dist:win
```

Optional local overrides can be placed in `.env`, using `.env.example` as a template.

Tagged pushes like `v0.1.0` run the Windows release workflow and upload Setup and Portable EXE artifacts to the GitHub Release.

## Privacy

Music Presence processes track metadata locally and sends only the Rich Presence payload to the local Discord desktop client. It does not store listening history, upload data, or run a background network service.

## Branding

This is not an official Apple or Discord app. The project intentionally uses a neutral name and original icon. Do not add Apple logos, Apple Music app icons, album artwork, or graphics copied from Apple websites/apps to this repository.

## License

MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
