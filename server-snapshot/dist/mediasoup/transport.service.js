"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransportService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mediasoup_service_1 = require("./mediasoup.service");
const rtc_room_service_1 = require("./rtc-room.service");
let TransportService = class TransportService {
    config;
    mediasoup;
    rooms;
    constructor(config, mediasoup, rooms) {
        this.config = config;
        this.mediasoup = mediasoup;
        this.rooms = rooms;
    }
    async create(roomId, peerId, direction) {
        const room = this.rooms.require(roomId);
        const peer = room.peers.get(peerId);
        if (!peer)
            throw new Error('Peer not joined to RTC room');
        const existing = [...peer.transports.values()].find((entry) => entry.direction === direction);
        if (existing)
            throw new Error(`${direction} transport already exists for this peer`);
        const slot = this.mediasoup.getSlot(room.workerIndex);
        const transport = await room.router.createWebRtcTransport({
            webRtcServer: slot.webRtcServer,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate: Number(this.config.get('MEDIASOUP_INITIAL_BITRATE') ?? 1_500_000),
            appData: { roomId, peerId, direction },
        });
        const maxIncoming = Number(this.config.get('MEDIASOUP_MAX_INCOMING_BITRATE') ?? 3_000_000);
        if (maxIncoming > 0)
            await transport.setMaxIncomingBitrate(maxIncoming);
        peer.transports.set(transport.id, { direction, transport });
        transport.observer.once('close', () => peer.transports.delete(transport.id));
        return this.toClientOptions(transport);
    }
    async connect(roomId, peerId, transportId, dtlsParameters) {
        const peer = this.rooms.getPeer(roomId, peerId);
        const entry = peer?.transports.get(transportId);
        if (!entry)
            throw new Error('Transport not found');
        await entry.transport.connect({ dtlsParameters });
    }
    close(roomId, peerId, transportId) {
        const peer = this.rooms.getPeer(roomId, peerId);
        const entry = peer?.transports.get(transportId);
        if (!peer || !entry)
            throw new Error('Transport not found');
        entry.transport.close();
        peer.transports.delete(transportId);
    }
    async restartIce(roomId, peerId, transportId) {
        const transport = this.get(roomId, peerId, transportId);
        return transport.restartIce();
    }
    get(roomId, peerId, transportId, expected) {
        const entry = this.rooms.getPeer(roomId, peerId)?.transports.get(transportId);
        if (!entry)
            throw new Error('Transport not found');
        if (expected && entry.direction !== expected)
            throw new Error(`Expected ${expected} transport`);
        return entry.transport;
    }
    toClientOptions(transport) {
        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
        };
    }
};
exports.TransportService = TransportService;
exports.TransportService = TransportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        mediasoup_service_1.MediasoupService,
        rtc_room_service_1.RtcRoomService])
], TransportService);
//# sourceMappingURL=transport.service.js.map