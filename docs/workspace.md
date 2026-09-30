# Workspace

The workspace is where you find hosts, connect to them and work with their files. It keeps your sessions running while you visit Snippets, Audit or Settings.

![Workspace](./assets/screenshots/workspace-dark.png)

## Inventory

The **Inventory** sidebar lists your organizations, folders and hosts. Drag its edge to resize it, or narrow it until it collapses.

- **Add a host** with **+** or right-click → **New** → SSH, Telnet, RDP or VNC server. Default ports: 22, 23, 3389, 5900.
- **Folders:** right-click → **Create folder**, **Rename folder**, **Delete folder**. Drag hosts and folders to reorder or move them, including into an organization or back to the top level.
- **Import:** right-click a folder or organization → **Import** → PVE, NetBox or SSH-Config (see [Integrations](./integrations.md)).
- **Tags:** right-click a host → **Tags** to create, assign, edit or delete tags. Assigned tags appear as colored dots.

The host dialog has three tabs:

| Tab | Content |
|---|---|
| Details | Name, icon, host name or IP address, port, protocol; MAC address and broadcast address when Wake-on-LAN is on |
| Identities | Credentials for SSH (password or SSH key with optional passphrase), RDP and VNC (password). Organization identities are shared with all members; personal identities only with you. |
| Settings | Jump hosts (SSH), Wake-on-LAN, terminal compatibility keys (SSH, Telnet), keyboard layout, pinned certificate and performance (RDP), display and audio (RDP, VNC) |

- **Wake-on-LAN broadcast address:** empty sends the magic packet to 255.255.255.255, which stays in INFRA-W's own network. For a host in another subnet, enter that subnet's broadcast address (for example `10.0.5.255`); the router must forward it.
- **Pinned certificate (RDP):** without a fingerprint, the server's certificate is not checked. With the SHA-1 or SHA-256 fingerprint (the Windows certificate thumbprint works), only that certificate is accepted; separate several with commas, for example during a certificate change.

Right-clicking a host offers **Connect**, **Open SFTP**, **Run script**, **Quick connect**, **Wake-on-LAN**, **Edit server**, **Duplicate server**, **Tags** and **Delete server**, plus **Resume session** when a paused session exists.

## Search

The search box (default shortcut **Ctrl+Shift+F**) matches host names, IP addresses, protocols, [operating systems](./os-detection.md), tags and the names of folders and organizations. Matching ignores case, and every word must match, so `prod ssh` finds SSH hosts in a folder called Production. Adding words only ever narrows the result.

The tag button next to the search box filters by tags; a host matches if it has any of the selected tags.

## Connecting

- **Double-click** a host in the sidebar to connect with its first identity, or right-click → **Connect** to choose an identity.
- In the overview, click a host under **Recent connections**, or continue a paused session under **Resume sessions**.
- **Quick action** (**Ctrl+Shift+L**) searches hosts, snippets and pages; choosing a host connects to it, choosing a snippet runs it in the active terminal.
- **Quick connect** connects once with credentials you type in (or a saved identity) without storing them on the host. It opens automatically for hosts without an identity.

If the host's organization requires it, you are asked for a **connection reason** (up to 500 characters) before connecting; it is recorded in the audit log.

**Sign-in prompts:** when an SSH server asks for more than the password during sign-in, for example a one-time code from Duo or Google Authenticator, a dialog *Sign in to …* shows its questions. The identity's password answers the password question automatically. Unanswered prompts cancel the connection after 2 minutes.

**Why a connection failed** is shown as a message with the host's name, for example a wrong password, an unreachable host or a changed host key.

**Host keys:** the first SSH connection to an address trusts the key the server presents. If the key changes later, the connection is refused until an administrator accepts the new key under **Settings → Host keys**, see [Host keys](./administration.md#host-keys).

## Sessions

Every connection opens a tab. Drag tabs to reorder them; close them with ×, a middle click or **Disconnect**.

Right-click a tab for:

| Action | Effect |
|---|---|
| Pop out | Opens the session in its own window; it returns to the tab bar when the window closes |
| Share read-only / Share with typing | Copies a link for others to watch or to type along, valid for 1, 8 or 24 hours; see [Sharing](#sharing) |
| Duplicate | Opens another session to the same host with the same identity |
| File manager | Opens the file manager for this SSH session |
| Hibernate | Hides the tab while the session keeps running on the server; resume it later from the host or the overview |

### Sharing

A share link lets people without an INFRA-W account watch a session, or type in it. SSH terminals and desktop sessions can be shared:

- Right-click the tab → **Share read-only** or **Share with typing** → the lifetime. The link is copied, and the message tells until when it works.
- While sharing, the same menu offers **Copy share link**, shows **Link valid until …**, **Change permissions** and **Stop sharing**.
- The link stops working when its time is up, when you stop sharing, or when the session ends. Viewers never get the file manager.

The host's organization can turn share links off, allow only read-only links, and set the maximum lifetime (1–168 hours, default 24; a longer choice is shortened to it), see [Audit settings](./organizations-and-audit.md#audit-settings). Starting and stopping a share is recorded in the audit log.

The toolbar above the tabs has:

- **Terminal actions**: snippets, keyboard shortcuts to send to RDP/VNC (for example Ctrl+Alt+Del), broadcasting and full screen.
- **Split view**: shows all open sessions in a grid with adjustable dividers. With **Broadcasting** on, what you type goes to every terminal at once.

Right-click inside a terminal to copy, paste, select all, insert a snippet, paste the identity's password, send Ctrl+C or clear the screen.

**Open sessions** (Settings → Preferences) decides where open sessions appear: on every device you sign in to, in all tabs of this browser (default), or only in the current browser tab. Sessions that are not paused are closed after 6 hours without activity.

## File manager

Open it with right-click on a terminal tab → **File manager**, or on a host → **Open SFTP** for a separate SFTP tab. It starts in your home directory. The file manager of a terminal tab is a window like the previews (see below): move it aside and keep working in the terminal behind it. Its keyboard shortcuts apply while you work in the file list.

![File manager with two previews side by side](./assets/screenshots/file-manager-dark.png)

- **Open:** a click opens folders, shows previews of images, video, audio and PDF files, opens other files up to 1 MB in the editor and downloads larger ones.
- **Select:** Ctrl/Cmd+click, Shift+↑/↓, or drag a selection box. The selection bar offers **Download** (as one zip) and **Delete**.
- **Upload:** **Upload** or drag files and folders from your computer into the list.
- **Create, rename, delete:** **Create file** and **Create folder** buttons, right-click → **Rename** or **Delete**. Deleting asks for confirmation unless you turned that off.
- **Move and copy:** drag items onto a folder or a part of the path. Depending on your preference they are moved, copied, or you choose. Ctrl/Cmd+C, X and V copy, cut and paste within the session.
- **Properties:** size, owner and dates, permissions (with octal value) and checksums (MD5, SHA-1, SHA-256, SHA-512).
- **Open terminal here** opens a new terminal tab that starts in the selected folder and switches to it; the file manager closes. For files and a terminal side by side, open the host with **Open SFTP** and use split view.

**Address bar:** click it to type or paste a path. It starts with the current folder, so its subfolders are suggested right away, hidden folders included: type `.` to see only dot-folders. Use ↑/↓ to choose, Tab to complete, Enter to go and Esc to cancel. A path to a file (for example `/etc/nginx/nginx.conf`) opens that file in the preview or the editor and shows its folder.

**Keyboard:** ↑/↓ move, Home/End jump, Space selects, Enter opens, Ctrl/Cmd+A selects all, Esc clears the selection.

### Preview and editor windows

Previews and the editor open in windows next to the file manager. Several can be open at once, for example to compare two diagrams:

- drag a window by its title bar, resize it from the lower right corner, and maximize it with the button or a double-click on the title bar;
- each new window opens slightly offset from the previous one, and clicking a window brings it to the front;
- windows stay open when you close the file manager and reappear when you return to the workspace.

Images open fitted to the window. The zoom slider below an image enlarges or reduces it from 10 to 400 %; a larger image scrolls inside the window, and the button next to the slider fits it to the window again.

The editor highlights syntax by file type. **Save** is enabled once you change something, an **Unsaved** badge shows pending changes, and closing asks before discarding them.

## Snippets and scripts

Snippets are reusable commands. Manage them on the **Snippets** page (personal or per organization); each can be limited to operating systems.

In a terminal, open them with **Ctrl+Shift+S**, the **Terminal actions** menu or right-click → **Insert snippet**. The list only offers snippets that fit the host's operating system; the chosen command runs immediately (in every terminal when broadcasting). **Run script** on a host starts an interactive script in its own tab, see [Scripts and snippets](./scripts&snippets.md).

## Keyboard shortcuts

Change or switch them off under **Settings → Keyboard shortcuts**. On macOS, Ctrl also accepts ⌘. The defaults leave keys the shell and tmux use in a terminal (such as Ctrl+S, Ctrl+P and Ctrl+B) to the terminal.

| Action | Default |
|---|---|
| Search hosts | Ctrl+Shift+F |
| Quick action | Ctrl+Shift+L |
| Snippets | Ctrl+Shift+S |
| Keyboard shortcuts menu (RDP/VNC) | Ctrl+Shift+K |
| Broadcast mode (split view) | Ctrl+Shift+B |
| Copy terminal selection | Ctrl+Shift+C |
| Full screen | F11 |

## Personal settings

Your preferences are stored with your account and follow you to every browser and device. Until you choose a theme, INFRA-W (including the sign-in page) follows the light or dark setting of your operating system; the sun/moon button in the header switches between light and dark at any time.

| Page | Settings |
|---|---|
| Preferences | Theme (system by default, light, dark, black), language, open sessions |
| Terminal | Font, font size, cursor style and blinking, color theme |
| File manager | Default view (list or grid), image thumbnails, hidden files, delete confirmation, drag-and-drop action (move, copy, ask) |
| Keyboard shortcuts | See above |
| Identities, Sessions, Organizations | Your credentials, signed-in browsers, and team memberships |
