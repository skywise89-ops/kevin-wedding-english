# Mac mini saved-collection sync

Node.js 22.13+ with `node:sqlite`. No runtime packages. Production uses Node 24 on the Mac mini, SQLite WAL, prepared statements and full synchronous commits.

The server listens on **127.0.0.1:18790** only. Tailscale Serve publishes the private HTTPS path `/wedding-sync`; public Funnel must not be used for this service. Serve strips client-supplied identity headers and inserts the authenticated `Tailscale-User-Login`. The same Tailscale account on iPhone and PC selects the same collection. Other accounts select independent collections. Anonymous and tagged-device requests without a user identity are rejected.

- Endpoint: `https://macmini.tailfde60c.ts.net/wedding-sync`
- Data: `~/Library/Application Support/WeddingEnglishSync/data/saved.sqlite`
- Code: `~/Library/Application Support/WeddingEnglishSync/code`
- LaunchAgent: `com.kevinjung.weddingenglish.sync`
- Default allowed web origin: `https://skywise89-ops.github.io`
- Config used by the static app: `data/sync-config.json`

## Data and recovery

Saved IDs, supplemental lesson sentence text, shooting-kit membership/order and kit name synchronize. Learning schedules, an active recall session and device-specific voice/display settings remain local. The original `kwe_state_v2` format stays compatible with v2/v3 backups.

First connection merges each device's existing collection at logical clock zero. An established removal has a higher clock and wins over an old initial import. Later operations increment the highest observed logical clock. Ties use stable device IDs; removals remain as tombstones, so repeated delivery cannot revive deleted items. No wall-clock synchronization is required.

Each tab stores its pending journal in `kwe_saved_sync_v1:<owner>:<actor>`. Other tabs collect pending records without overwriting them, including edits from closed tabs. A separate account cache retains the last server snapshot. SQLite merges a batch within one transaction. Live server events notify other devices; a 15-second foreground check recovers missed events. Account changes select a separate cached profile and the server rejects a write addressed to the previous account.

Concurrent shooting kits can exceed the local 24-item limit. The first 24 are displayed and the status reports overflow. The server retains other entries; removing a displayed entry exposes the next one. If merged favorites or supplemental sentences exceed the existing app limits, applying the remote list stops with a visible error and keeps the current local list.

Automatic daily backups use SQLite `VACUUM INTO`, not a live file copy. Create an immediate backup on the Mac mini:

```sh
cd "$HOME/Library/Application Support/WeddingEnglishSync/code"
/usr/local/bin/node server/main.cjs --backup
```

Backups are private files under `data/backups`. They include tombstones and user namespaces. Stop the LaunchAgent before restoring a known backup; preserve the current database and WAL files first. Do not delete browser journals to troubleshoot connection failures.

## Checks

`GET /health` returns only service health. All `/v1/*` data routes require Tailscale identity. `GET /v1/state` returns the requesting account's snapshot; `POST /v1/sync` validates all operations before changing SQLite; `GET /v1/events` streams revision notifications. CORS, request-size/count limits and per-account rate limits are enforced.

```sh
npm test
KWE_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:sync-browser
```

The two-device browser suite runs Chromium and WebKit against real SQLite and a test proxy modeling Serve identity injection. Production identity and TLS must also be checked through the private Mac mini URL. Actual iPhone Safari/PWA testing is separate.

References: [Tailscale identity headers](https://tailscale.com/docs/features/tailscale-serve#identity-headers), [Node SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).
