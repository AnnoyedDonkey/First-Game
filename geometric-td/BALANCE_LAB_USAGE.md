# Balance Lab — local usage

Use the Balance Lab to tune gameplay numbers without editing JavaScript.

1. In the project folder, run `./serve.ps1`.
2. Open `http://localhost:8420/balance-lab.html`.
3. Edit a value, or choose a campaign level and add or edit a wave group. The Lab shows validation and a Changes preview as you work. Map geometry is displayed but read-only for now.
4. Enter a clear revision note and select **Save revision**. A note is required. The Lab writes `src/balance-data.json`, regenerates `src/balance-data.js`, and records a snapshot in `balance-history/`.
5. If the Lab says the data is **stale — reload**, another save changed the on-disk revision. Select **Reload from server** to discard this draft and load the newest revision, then make the edit again if it is still wanted.
6. Reload `http://localhost:8420/index.html` and test the change locally.
7. To undo an experiment, open **History**, select **Restore** on the desired revision, review the diff, then save the pre-filled restore note. Restore is append-only: it creates a new revision and keeps the original snapshot.
8. Review `git status` and `git diff`, then manually run `git add` and `git commit` when ready. The Lab never commits or pushes.

## What the files are

- `src/balance-data.json` — canonical editable balance data.
- `src/balance-data.js` — generated synchronous game import; do not edit it.
- `balance-history/` — git-tracked revision snapshots and `manifest.json`.

## Deferred: home-LAN phone access

`serve.ps1 -LabLan` is deliberately **not built**. A future explicit flag may bind the Lab beyond localhost for editing from a phone on the home network. It must remain LAN-only, never expose the Lab to the public internet, keep localhost as the default, and relax the loopback check only under that explicit flag. GitHub Pages is never a writable admin surface.
