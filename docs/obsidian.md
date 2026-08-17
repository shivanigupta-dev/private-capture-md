# Obsidian integration

Private Capture uses Obsidian's strongest interoperability feature: the vault is a folder of files.

## Obsidian CLI

Obsidian 1.12 added an official CLI. It can create, read, search, and open notes, but the [official documentation](https://obsidian.md/help/cli) says the Obsidian desktop app must be running; the first command launches it.

Private Capture therefore does not require the CLI for saving. Direct append-only file creation:

- works while Obsidian is closed;
- works with any Markdown editor;
- has a smaller permission surface;
- avoids making Obsidian a server dependency.

The CLI may become a useful optional hook later—for example, to open the file that was just captured or trigger an Obsidian command on a desktop. It should remain an adapter, not the storage layer.

## Obsidian Headless

Obsidian also offers [Headless Sync](https://obsidian.md/help/sync/headless), currently in open beta. It runs Obsidian Sync without the desktop app and is useful on an always-on Linux machine.

That is a good optional deployment for someone who already pays for Obsidian Sync:

```text
phone → Private Capture → local Linux vault → Obsidian Headless → Obsidian Sync
```

Private Capture itself does not need the `ob` command. Point it at the local vault directory that Headless Sync watches. Obsidian warns not to run the desktop Sync client and Headless Sync on the same device for the same vault.

## No `.obsidian` changes

The setup command creates one new folder inside the vault. It does not install a plugin, change hotkeys, add CSS snippets, or modify `.obsidian`. The approval parser rejects `.obsidian` as a root or path segment.

## Search and properties

Each capture has simple properties that Obsidian can index immediately: type, ID, creation time, privacy, title, capture type, and inbox state. The body stays ordinary Markdown. No Dataview or community plugin is required.
