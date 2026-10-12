# Mac mini sync QA

Date: 2026-10-12 KST. Wedding English v3.5. The user's Mac mini is the datastore; Firebase is not involved.

## Confirmed

- `npm test`: 42 tests passed, including initial-device union, stale-import deletion protection, independent offline edits, deterministic conflicts, sentence snapshots, kit order/overflow, tab rebasing, malformed data, authenticated/isolated API access, atomic SQLite writes, backup and process restart.
- `npm run test:browser`: 319 existing Chromium/WebKit checks passed. Search, lesson saves, learning progress, backups, offline assets, visual controls and immutable updates retain their behavior.
- `npm run test:sync-browser`: 30 checks passed across Chromium and WebKit with two isolated browser contexts and a real SQLite backend. Initial favorites merge, live field refresh, supplemental sentence transfer, offline additions/removals survive reload, reconnect after SQLite restart, account isolation, cached profile return, closed-tab outbox delivery, stale-journal deletion protection, actual backup-replacement propagation, backup warning, 320px layout and future-version protection are covered.
- Production Mac mini runs Node 24.19.0 and native SQLite, bound to 127.0.0.1:18790. A LaunchAgent starts it automatically. Private HTTPS endpoint and allowed GitHub Pages CORS origin were verified from the MacBook.
- Actual Tailscale Serve identity was verified. A client-supplied test identity header was stripped, retaining the authenticated account. Unauthenticated local API access is rejected in tests. No password or API secret is published in the repository.
- Tailscale reports the online iOS and MacBook peers share the same user account. Existing Serve routes were compared before/after installation and preserved. Funnel remains disabled.
- Initial server backup was created with SQLite `VACUUM INTO`. Database and backup use private filesystem permissions. Daily backup is built into the server.

## Data scope and limits

Saved IDs, lesson sentence snapshots, shooting-kit membership/order and kit name synchronize. Learning progress, active sessions and voice/display settings remain device-local and are preserved when a remote saved collection is applied. Backup format and `kwe_state_v2` remain compatible.

Each tab has an independent durable pending journal. Closed-tab edits are adopted by another tab. The local outbox uses logical clocks. Snapshot application does not generate new user edits. Tombstones prevent old initial imports from reviving removed items. Identity transitions use separate local journals and the API rejects writes addressed to another account.

At more than 24 merged kit entries, the UI displays 24 and reports retained overflow. Existing limits of 1,000 favorites and 500 supplemental snapshots are enforced during application; an excessive merged list produces an error and leaves the local collection intact.

The general browser suite substitutes an unset endpoint so it does not contact the user's production server. The sync suite injects identity through a local proxy modeling Tailscale Serve and tests CORS through a separate HTTP origin. Production TLS/identity are checked independently.

## Not verified on a physical iPhone

Actual Safari/PWA interaction, any local-network permission prompt, background suspension duration, VoiceOver and device-specific network reconnection remain unverified. Both devices need an enabled Tailscale connection and the updated app. Browser emulation is not a physical-device test.

Artifacts: `sync-browser-results.json`, `sync-settings-*.png`, `unit-results.txt`, existing `browser-results.json`. Production deployment verification is recorded separately after publishing. Failed release installs wait for all cache writes before cleanup; release revision includes the service-worker template.

References: [Tailscale Serve identity](https://tailscale.com/docs/features/tailscale-serve#identity-headers), [Node 24 SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).
