---
layout: home

hero:
  name: INFRA-W
  text: Infrastructure Workspace
  tagline: Self-hosted browser access to SSH, RDP and VNC, with file management, snippets and scripts, integrations and a complete audit trail.
  actions:
    - theme: brand
      text: Install INFRA-W
      link: /installation
    - theme: alt
      text: Using the workspace
      link: /workspace
    - theme: alt
      text: GitHub
      link: https://github.com/swissmakers/infra-w
  image:
    src: /logo.svg
    alt: INFRA-W logo

features:
  - title: Remote access in the browser
    details: SSH and Telnet terminals, RDP and VNC desktops in tabs that keep running while you work elsewhere. Pop out or share a session.
    link: /workspace
  - title: File manager
    details: Browse, upload and edit files over SFTP. Previews open in movable windows, so files can be compared side by side.
    link: /workspace#file-manager
  - title: Sign-in and identity
    details: Local accounts with two-factor authentication and passkeys, LDAP with FreeIPA and Active Directory presets, and OIDC single sign-on.
    link: /ldap
  - title: Snippets and scripts
    details: Reusable commands and interactive scripts, limited to the operating systems they are written for.
    link: /scripts&snippets
  - title: NetBox and Proxmox
    details: Import and keep hosts in sync from NetBox, and manage Proxmox VMs and containers from the inventory.
    link: /integrations
  - title: Audit and recordings
    details: Every connection and change is logged; organizations can record sessions and require a connection reason.
    link: /organizations-and-audit
---

<style>
:root {
  --vp-home-hero-name-color: #2a5bd6;
  --vp-home-hero-image-background-image: linear-gradient(rgba(42, 91, 214, 0.22), rgba(42, 91, 214, 0.22));
  --vp-home-hero-image-filter: blur(100px);
}
</style>

![INFRA-W workspace with the host inventory and recent connections](./assets/screenshots/workspace-dark.png)
