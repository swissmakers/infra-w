# Operating System Detection

INFRA-W recognizes the operating system of SSH hosts. The result is shown in the workspace, can be searched for, and decides which OS-specific snippets and scripts are offered for a host.

## How it works

After an interactive SSH session has connected, INFRA-W runs one short command over a separate channel, as the identity you connected with:

```sh
sh -c 'cat /etc/os-release 2>/dev/null; test -x /usr/bin/pveversion && echo INFRA_W_PVE=1'
```

- It never delays the connection and gives up after 5 seconds; at most 16 KB of output are read.
- A host is checked at most once every 24 hours. A failed check (for example on network devices or restricted shells) keeps the last known result.
- Proxmox VE reports Debian in `os-release`, so the presence of `pveversion` marks it as **Proxmox VE**.
- Known distributions are mapped to fixed names: Ubuntu, Debian, Alpine Linux, Fedora, CentOS, Red Hat, Rocky Linux, AlmaLinux, Oracle Linux, openSUSE, SUSE Linux Enterprise and Arch Linux. These, plus Proxmox VE, are the names snippets and scripts can be limited to. Other systems keep the name from `os-release`.

Only SSH terminal sessions trigger detection. RDP, VNC and Telnet hosts, and file-manager-only (SFTP) sessions, are not probed. The command appears in the host's process list and logs like any other SSH command.

## Where you see it

- **Workspace overview**: recent connections and paused sessions show the operating system next to the address.
- **Search**: the inventory search also matches the operating system, so `debian` or `rocky` lists those hosts.
- **Snippets and scripts**: snippets and scripts can be limited to operating systems. The terminal snippet menu and the script menu only offer the ones that match the host. For hosts whose OS is not known yet, entries without a restriction are shown.

## Limits

The detected OS cannot be edited or refreshed by hand; it is updated on the next SSH connection after 24 hours. There is currently no setting to turn detection off.
