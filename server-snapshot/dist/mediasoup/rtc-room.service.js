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
var RtcRoomService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RtcRoomService = void 0;
const common_1 = require("@nestjs/common");
const mediasoup_service_1 = require("./mediasoup.service");
const media_config_1 = require("./media.config");
let RtcRoomService = RtcRoomService_1 = class RtcRoomService {
    mediasoup;
    logger = new common_1.Logger(RtcRoomService_1.name);
    rooms = new Map();
    constructor(mediasoup) {
        this.mediasoup = mediasoup;
    }
    async create(roomId) {
        const existing = this.rooms.get(roomId);
        if (existing)
            return existing;
        const slot = this.mediasoup.getLeastLoadedSlot();
        const router = await slot.worker.createRouter({ mediaCodecs: media_config_1.mediaCodecs, appData: { roomId } });
        this.mediasoup.registerRouter(slot.index, router);
        const room = {
            id: roomId,
            workerIndex: slot.index,
            router,
            peers: new Map(),
            createdAt: Date.now(),
        };
        this.rooms.set(roomId, room);
        router.observer.once('close', () => this.rooms.delete(roomId));
        this.logger.log(`RTC room ${roomId} created on worker ${slot.index}`);
        return room;
    }
    get(roomId) {
        return this.rooms.get(roomId);
    }
    require(roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            throw new Error(`RTC room ${roomId} not found`);
        return room;
    }
    getRtpCapabilities(roomId) {
        return this.require(roomId).router.rtpCapabilities;
    }
    upsertPeer(roomId, input) {
        const room = this.require(roomId);
        const existing = room.peers.get(input.peerId);
        if (existing) {
            existing.socketId = input.socketId;
            existing.connected = input.connected;
            existing.displayName = input.displayName;
            existing.role = input.role;
            return existing;
        }
        const peer = {
            ...input,
            joinedAt: Date.now(),
            transports: new Map(),
            producers: new Map(),
            consumers: new Map(),
        };
        room.peers.set(peer.peerId, peer);
        return peer;
    }
    getPeer(roomId, peerId) {
        return this.rooms.get(roomId)?.peers.get(peerId);
    }
    markPeerDisconnected(roomId, peerId) {
        const peer = this.getPeer(roomId, peerId);
        if (peer) {
            peer.connected = false;
            peer.socketId = undefined;
        }
    }
    closePeer(roomId, peerId) {
        const room = this.rooms.get(roomId);
        const peer = room?.peers.get(peerId);
        if (!room || !peer)
            return;
        for (const entry of peer.consumers.values()) {
            try {
                entry.consumer.close();
            }
            catch { }
        }
        for (const entry of peer.producers.values()) {
            try {
                entry.producer.close();
            }
            catch { }
        }
        for (const entry of peer.transports.values()) {
            try {
                entry.transport.close();
            }
            catch { }
        }
        peer.consumers.clear();
        peer.producers.clear();
        peer.transports.clear();
        room.peers.delete(peerId);
    }
    closeRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        for (const peerId of [...room.peers.keys()])
            this.closePeer(roomId, peerId);
        try {
            room.router.close();
        }
        catch { }
        this.rooms.delete(roomId);
        this.logger.log(`RTC room ${roomId} closed`);
    }
    listRooms() {
        return [...this.rooms.values()];
    }
};
exports.RtcRoomService = RtcRoomService;
exports.RtcRoomService = RtcRoomService = RtcRoomService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mediasoup_service_1.MediasoupService])
], RtcRoomService);
//# sourceMappingURL=rtc-room.service.js.map