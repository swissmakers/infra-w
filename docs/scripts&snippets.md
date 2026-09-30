# Scripts & Snippets

The **Snippets** page holds two kinds of reusable commands:

- **Snippets**: one command line (or a few) that runs in a terminal you already have open.
- **Scripts**: a complete bash script that INFRA-W uploads to a host and runs with guided prompts, progress and results.

Both are created and edited on the Snippets page. Nothing is loaded from files or repositories.

## Personal and organization items

The selector next to the search switches between **Personal** items and the items of an organization you belong to.

- Personal items are visible only to you.
- Organization items are shared with all members of that organization.
- An organization script is offered only for hosts of that organization. Personal scripts are offered for every host you can reach.

Drag rows to change their order. The order is the same in every picker. Reordering is off while a search is active.

## Search

The search field matches the name, the description and the command or script code. For example, `ss -t` finds a snippet whose command is `ss -tulpn`.

## OS filter

Every snippet and script can be limited to operating systems. Hosts report their OS through [OS detection](./os-detection.md), and the pickers then only offer items that fit the host:

`Ubuntu`, `Debian`, `Alpine Linux`, `Fedora`, `CentOS`, `Red Hat`, `Rocky Linux`, `AlmaLinux`, `Oracle Linux`, `openSUSE`, `SUSE Linux Enterprise`, `Arch Linux`, `Proxmox VE`

Items without a filter are offered everywhere. Hosts whose OS is not detected yet also see OS-specific items.

## Using snippets

- **Terminal actions → Snippets**, or right-click in a terminal → **Insert snippet**.
- **Quick action** (**Ctrl+Shift+L**): search for the snippet and choose it.

The command runs at once in the active terminal. While broadcasting, it runs in every terminal of the grid.

## Running scripts

There are two ways to start a script:

- In the inventory, right-click an SSH host → **Run script**, then pick the script (and the identity, if the host has several).
- On the Snippets page, open the **Scripts** tab and choose **Run on a host** (the play button). The picker lists only the hosts the script fits: SSH hosts with an identity, in the script's organization and with a matching OS. The workspace then opens the connection and starts the script. If the organization requires a connection reason, you are asked for it first.

Each run is recorded in the audit log (**Script run**).

### How a script runs

INFRA-W always runs a script with **bash** and `set -e`:

1. The script is sent to the host base64-encoded, written to a temporary file (`mktemp`) and made executable.
2. It runs as `#!/bin/bash` with `set -e`, so the first failing command stops it. A shebang line of your own is ignored.
3. The temporary file is removed and the exit code is reported.

The host therefore needs `bash`, `base64` and `mktemp`, which every supported Linux distribution provides.

`sudo` calls are rewritten to `sudo -S`. When sudo asks for a password, INFRA-W shows a password prompt instead of hanging.

### Interactive directives

Scripts can ask for input, confirm actions, report progress and show results with `@INFRA-W:*` lines, for example:

```sh
@INFRA-W:STEP "Check free space"
@INFRA-W:CONFIRM "Clean the package cache?"
dnf clean all
@INFRA-W:SUCCESS "Cache cleaned"
```

See [Scripting Variables & Directives](./ScriptingVariables.md) for all directives.

## Guidelines

- Keep scripts idempotent where possible; they may run again after an interruption.
- Remember `set -e`: add `|| true` to commands whose failure is expected.
- Put a `@INFRA-W:CONFIRM` before destructive steps and describe them in the script description.
- Test a script on a non-production host first.
