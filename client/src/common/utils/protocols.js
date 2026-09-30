export const PROTOCOLS = {
    ssh: { port: 22, renderer: "terminal", icon: "mdiConsole" },
    telnet: { port: 23, renderer: "terminal", icon: "mdiConsole" },
    rdp: { port: 3389, renderer: "guac", icon: "mdiMicrosoftWindows" },
    vnc: { port: 5900, renderer: "guac", icon: "mdiMonitor" },
};

export const protocolIcon = (protocol, type) =>
    type?.startsWith("pve") ? "mdiServerNetwork" : PROTOCOLS[protocol]?.icon || "mdiServerNetwork";

export const protocolPort = protocol => PROTOCOLS[protocol]?.port ?? PROTOCOLS.ssh.port;
