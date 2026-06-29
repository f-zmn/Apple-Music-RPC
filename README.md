# Music Presence

Music Presence is a Windows tray app that shows the current Apple Music track and album cover as Discord Rich Presence.

It reads local playback state from Windows System Media Transport Controls (SMTC), resolves cover artwork through Apple's public iTunes Search API, and talks to the local Discord desktop client through Discord RPC. It does not use an Apple account, Apple Music developer token, Discord bot token, backend service, analytics, or telemetry.

## Status

This repository is ready for development and packaging. Public builds include a maintainer-owned Discord Developer Application client ID so users can run the app without creating a config file.

The client ID is not a secret. Do not commit Discord application secrets or tokens.

## User Install

1. Download the latest Windows installer or portable EXE [here](https://github.com/f-zmn/Apple-Music-RPC/releases).
2. Start Music Presence.
3. Start Discord desktop.
4. Play music in the Apple Music Windows app.

The tray menu shows the current status, reconnect and refresh commands, a clear activity command, diagnostics, an autostart toggle, and quit.

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

## Privacy

Music Presence processes track metadata locally and sends only the Rich Presence payload to the local Discord desktop client. To show cover artwork, it sends the current title and artist to Apple's public iTunes Search API and uses the returned artwork URL. It does not store listening history, upload cover files, or run a background network service.

Diagnostics are written locally only and record connection/status events without track titles.

## Branding

This is not an official Apple or Discord app. 

## License

MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
