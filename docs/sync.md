# Sync without making sync the product

Private Capture writes ordinary files into an ordinary folder. That lets you choose a sync tool independently, but it also means the sync tool's behavior matters.

The safest general pattern is:

1. Keep a complete local copy of the vault or capture folder.
2. Point Private Capture at that local copy.
3. Let one folder-sync tool replicate it.
4. Keep a separate, versioned backup.

Do not combine Obsidian Sync with another bidirectional sync service on the same vault. Obsidian [warns that this can create duplicates or corruption](https://obsidian.md/help/sync/faq).

## Google Drive for desktop

Google Drive works best here as a local mirrored folder on macOS or Windows.

1. Install [Google Drive for desktop](https://support.google.com/drive/answer/10838124).
2. Open Drive for desktop → **Settings** → **Preferences**.
3. Under **Google Drive**, select **Mirror files**. Google says mirrored files remain ordinary local files and are available when the Drive app is not running. If you use streaming instead, mark the entire vault folder **Available offline**.
4. Create or move your Obsidian vault into the mirrored `My Drive` folder.
5. Wait until Drive reports that the move has finished syncing.
6. Run `private-capture init --vault "/local/path/to/the/vault"`.
7. Make a synthetic capture, confirm the `.md` file appears locally, then confirm it appears in Drive on another device.

Mirroring uses more disk space but is a better fit for an application that creates and flushes small files. Google's [mirror-versus-stream guide](https://support.google.com/drive/answer/13401938) notes that streaming depends on the Drive process and keeps many files in a cache.

### Phone limitation

Google Drive is not a complete iPhone-to-Obsidian vault solution. Obsidian's current sync guide says Google Drive has [limited functionality on iOS and is not officially supported there for vault sync](https://obsidian.md/help/Getting%20started/Sync%20your%20notes%20across%20devices#Google%20Drive).

For iPhone capture, use one of these instead:

- Private Capture on an always-on machine over a private VPN;
- the **Download .md** button, then move the file in the Files app;
- iCloud for an Apple-only vault;
- Obsidian Sync.

On Android, a folder-sync app can place Google Drive files in local shared storage, but test conflict behavior with synthetic notes before trusting a real vault.

## Dropbox and OneDrive

Use the same pattern: point Private Capture at a local folder and make the entire vault permanently available offline. Disable online-only or files-on-demand behavior for that folder.

Obsidian's [cross-device sync guide](https://obsidian.md/help/Getting%20started/Sync%20your%20notes%20across%20devices) lists platform limitations for each provider. Read the relevant section before moving a vault.

## iCloud

iCloud is the simplest file-based option for a Mac + iPhone setup, but the vault must be in the special `iCloud Drive/Obsidian/` location on iOS. Mark it **Keep Downloaded** on recent macOS versions. Follow Obsidian's [iCloud instructions](https://obsidian.md/help/Getting%20started/Sync%20your%20notes%20across%20devices#iCloud) exactly.

## Syncthing

Syncthing is a good no-subscription choice between computers and Android. It is not available as a normal background folder-sync tool on iOS. Configure versioning on at least one device, make the vault folder send-and-receive only where edits really happen, and inspect conflict files instead of deleting them automatically.

## What Private Capture does not do

It does not authenticate to Google, Dropbox, Microsoft, Apple, or Syncthing. It does not know the provider's account name, API, mount path, or credentials. To Private Capture, a synced folder is just a local folder.
