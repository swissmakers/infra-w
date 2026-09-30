const dgram = require("dgram");
const logger = require("./logger");

const WOL_PORT = 9;
const DEFAULT_BROADCAST = "255.255.255.255";

const parseMacAddress = (mac) => {
    const cleaned = mac.replace(/[:-]/g, "");
    if (cleaned.length !== 12 || !/^[a-fA-F0-9]+$/.test(cleaned)) {
        throw new Error(`Invalid MAC address: ${mac}`);
    }
    return Buffer.from(cleaned, "hex");
};

const createMagicPacket = (macBuffer) => {
    const packet = Buffer.alloc(102);
    packet.fill(0xff, 0, 6);
    for (let i = 0; i < 16; i++) {
        macBuffer.copy(packet, 6 + i * 6);
    }
    return packet;
};

const sendWakeOnLan = (mac, { broadcast = DEFAULT_BROADCAST } = {}) => {
    return new Promise((resolve, reject) => {
        const macBuffer = parseMacAddress(mac);
        const packet = createMagicPacket(macBuffer);
        const socket = dgram.createSocket("udp4");

        socket.on("error", (err) => {
            socket.close();
            reject(err);
        });

        socket.once("listening", () => {
            socket.setBroadcast(true);
            socket.send(packet, WOL_PORT, broadcast, (err) => {
                socket.close();
                if (err) {
                    reject(err);
                } else {
                    logger.info(`Wake-On-LAN packet sent to ${mac}`, { broadcast });
                    resolve();
                }
            });
        });

        socket.bind();
    });
};

module.exports = { sendWakeOnLan };
