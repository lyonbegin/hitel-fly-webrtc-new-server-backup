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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const config_1 = require("@nestjs/config");
const socket_io_1 = require("socket.io");
const auth_service_1 = require("../auth/auth.service");
const types_1 = require("../common/types");
const session_service_1 = require("./session.service");
const rtc_room_service_1 = require("../mediasoup/rtc-room.service");
const transport_service_1 = require("../mediasoup/transport.service");
const producer_consumer_service_1 = require("../mediasoup/producer-consumer.service");
const realtime_dto_1 = require("./dto/realtime.dto");
let RealtimeGateway = class RealtimeGateway {
    config;
    auth;
    sessions;
    rooms;
    transports;
    media;
    server;
    memberships = new Map();
    disconnectTimers = new Map();
    constructor(config, auth, sessions, rooms, transports, media) {
        this.config = config;
        this.auth = auth;
        this.sessions = sessions;
        this.rooms = rooms;
        this.transports = transports;
        this.media = media;
        this.media.events.on('producerClosed', (event) => {
            const session = this.sessions.findByRtcRoomId(event.roomId);
            if (!session || !this.server)
                return;
            this.server.to(this.sessionRoom(session.id)).emit('rtc:producer-closed', {
                sessionId: session.id,
                producerId: event.producerId,
                peerId: event.peerId,
                userId: event.userId,
                kind: event.kind,
                source: event.source,
            });
        });
    }
    async handleConnection(client) {
        try {
            const handshakeToken = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : undefined;
            const headerToken = this.auth.extractBearer(client.handshake.headers.authorization);
            client.data.auth = await this.auth.verify(handshakeToken ?? headerToken);
            this.memberships.set(client.id, new Set());
            client.emit('connection:ready', { userId: client.data.auth.sub, socketId: client.id });
        }
        catch (error) {
            client.emit('connection:error', { code: 'UNAUTHORIZED', message: error?.message ?? 'Unauthorized' });
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        const userId = client.data.auth?.sub;
        if (!userId)
            return;
        const sessionIds = this.memberships.get(client.id) ?? new Set();
        this.memberships.delete(client.id);
        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (!session)
                continue;
            this.sessions.markDisconnected(sessionId, userId);
            if (session.rtcRoomId)
                this.rooms.markPeerDisconnected(session.rtcRoomId, userId);
            this.server.to(this.sessionRoom(sessionId)).emit('session:participant-disconnected', { sessionId, userId });
            this.schedulePeerCleanup(sessionId, userId);
        }
    }
    async joinSession(client, dto) {
        return this.safe(async () => {
            const userId = this.userId(client);
            const participant = this.sessions.join(dto.sessionId, userId);
            await client.join(this.sessionRoom(dto.sessionId));
            this.memberships.get(client.id)?.add(dto.sessionId);
            this.cancelPeerCleanup(dto.sessionId, userId);
            client.to(this.sessionRoom(dto.sessionId)).emit('session:participant-joined', {
                sessionId: dto.sessionId,
                participant,
            });
            return {
                session: this.sessions.toPublic(this.sessions.require(dto.sessionId)),
                participant,
            };
        });
    }
    ready(client, dto) {
        return this.safeSync(() => {
            const userId = this.userId(client);
            const participant = this.sessions.markReady(dto.sessionId, userId, dto.ready);
            this.server.to(this.sessionRoom(dto.sessionId)).emit('session:participant-ready', {
                sessionId: dto.sessionId,
                userId,
                ready: dto.ready,
            });
            return { participant, session: this.sessions.toPublic(this.sessions.require(dto.sessionId)) };
        });
    }
    async startSession(client, dto) {
        return this.safe(async () => {
            const session = await this.sessions.start(dto.sessionId, this.userId(client));
            const publicSession = this.sessions.toPublic(session);
            this.server.to(this.sessionRoom(dto.sessionId)).emit('session:started', { session: publicSession });
            return { session: publicSession };
        });
    }
    endSession(client, dto) {
        return this.safeSync(() => {
            const session = this.sessions.end(dto.sessionId, this.userId(client));
            const publicSession = this.sessions.toPublic(session);
            this.server.to(this.sessionRoom(dto.sessionId)).emit('session:ended', { session: publicSession });
            return { session: publicSession };
        });
    }
    async leaveSession(client, dto) {
        return this.safe(async () => {
            const userId = this.userId(client);
            this.cancelPeerCleanup(dto.sessionId, userId);
            this.sessions.leave(dto.sessionId, userId);
            this.memberships.get(client.id)?.delete(dto.sessionId);
            await client.leave(this.sessionRoom(dto.sessionId));
            this.server.to(this.sessionRoom(dto.sessionId)).emit('session:participant-left', { sessionId: dto.sessionId, userId });
            return {};
        });
    }
    getSessionState(client, dto) {
        return this.safeSync(() => {
            this.sessions.requireParticipant(dto.sessionId, this.userId(client));
            return { session: this.sessions.toPublic(this.sessions.require(dto.sessionId)) };
        });
    }
    rtcJoin(client, dto) {
        return this.safeSync(() => {
            const userId = this.userId(client);
            const session = this.sessions.require(dto.sessionId);
            const participant = this.sessions.requireParticipant(dto.sessionId, userId);
            if (session.status !== 'LIVE' || !session.rtcRoomId)
                throw new Error('Session is not live');
            const existing = this.rooms.getPeer(session.rtcRoomId, userId);
            let resumed = false;
            if (existing) {
                if (dto.resume && !existing.connected) {
                    existing.socketId = client.id;
                    existing.connected = true;
                    resumed = true;
                }
                else if (existing.socketId !== client.id) {
                    this.rooms.closePeer(session.rtcRoomId, userId);
                }
            }
            const peer = this.rooms.upsertPeer(session.rtcRoomId, {
                peerId: userId,
                userId,
                socketId: client.id,
                displayName: participant.displayName,
                role: participant.role,
                connected: true,
            });
            participant.presence = 'LIVE';
            this.cancelPeerCleanup(dto.sessionId, userId);
            client.to(this.sessionRoom(dto.sessionId)).emit(resumed ? 'rtc:peer-resumed' : 'rtc:peer-joined', {
                sessionId: dto.sessionId,
                peerId: peer.peerId,
                userId,
                role: participant.role,
                displayName: participant.displayName,
            });
            return {
                peerId: peer.peerId,
                resumed,
                routerRtpCapabilities: session.rtcRoomId ? this.rooms.getRtpCapabilities(session.rtcRoomId) : undefined,
                existingProducers: this.media.listOtherProducers(session.rtcRoomId, userId),
            };
        });
    }
    async createTransport(client, dto) {
        return this.safe(async () => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            if (dto.direction !== 'send' && dto.direction !== 'recv')
                throw new Error('Invalid transport direction');
            const participant = this.sessions.requireParticipant(dto.sessionId, userId);
            if (dto.direction === 'send' && !participant.permissions.publishAudio && !participant.permissions.publishVideo && !participant.permissions.shareScreen) {
                throw new Error('Participant is not allowed to publish media');
            }
            if (dto.direction === 'recv' && !participant.permissions.consumeAudio && !participant.permissions.consumeVideo) {
                throw new Error('Participant is not allowed to consume media');
            }
            const transportOptions = await this.transports.create(roomId, userId, dto.direction);
            return { transportOptions };
        });
    }
    async connectTransport(client, dto) {
        return this.safe(async () => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            await this.transports.connect(roomId, userId, dto.transportId, dto.dtlsParameters);
            return {};
        });
    }
    async restartIce(client, dto) {
        return this.safe(async () => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            const iceParameters = await this.transports.restartIce(roomId, userId, dto.transportId);
            return { iceParameters };
        });
    }
    closeTransport(client, dto) {
        return this.safeSync(() => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            this.transports.close(roomId, userId, dto.transportId);
            return {};
        });
    }
    async produce(client, dto) {
        return this.safe(async () => {
            const userId = this.userId(client);
            const session = this.sessions.require(dto.sessionId);
            if (!session.rtcRoomId || session.status !== 'LIVE')
                throw new Error('Session is not live');
            const source = typeof dto.appData?.source === 'string' ? dto.appData.source : undefined;
            if (source === 'screen')
                this.sessions.requirePermission(dto.sessionId, userId, 'shareScreen');
            if (dto.kind === 'audio')
                this.sessions.requirePermission(dto.sessionId, userId, 'publishAudio');
            if (dto.kind === 'video' && source !== 'screen')
                this.sessions.requirePermission(dto.sessionId, userId, 'publishVideo');
            const existingPeer = this.rooms.getPeer(session.rtcRoomId, userId);
            const alreadyPublishingKind = [...(existingPeer?.producers.values() ?? [])].some((entry) => entry.producer.kind === dto.kind);
            if (!alreadyPublishingKind && dto.kind === 'video' && session.policy.maxVideoPublishers !== undefined) {
                if (this.media.countPublishingPeers(session.rtcRoomId, 'video') >= session.policy.maxVideoPublishers) {
                    throw new Error('Video publisher limit reached');
                }
            }
            if (!alreadyPublishingKind && dto.kind === 'audio' && session.policy.maxAudioPublishers !== undefined) {
                if (this.media.countPublishingPeers(session.rtcRoomId, 'audio') >= session.policy.maxAudioPublishers) {
                    throw new Error('Audio publisher limit reached');
                }
            }
            const producer = await this.media.produce({
                roomId: session.rtcRoomId,
                peerId: userId,
                transportId: dto.transportId,
                kind: dto.kind,
                rtpParameters: dto.rtpParameters,
                appData: dto.appData,
            });
            client.to(this.sessionRoom(dto.sessionId)).emit('rtc:new-producer', { sessionId: dto.sessionId, ...producer });
            return producer;
        });
    }
    listProducers(client, dto) {
        return this.safeSync(() => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            return { producers: this.media.listOtherProducers(roomId, userId) };
        });
    }
    async consume(client, dto) {
        return this.safe(async () => {
            const userId = this.userId(client);
            const session = this.sessions.require(dto.sessionId);
            if (!session.rtcRoomId || session.status !== 'LIVE')
                throw new Error('Session is not live');
            const target = this.media.getProducer(session.rtcRoomId, dto.producerId);
            if (target.entry.producer.kind === 'audio')
                this.sessions.requirePermission(dto.sessionId, userId, 'consumeAudio');
            if (target.entry.producer.kind === 'video')
                this.sessions.requirePermission(dto.sessionId, userId, 'consumeVideo');
            const consumer = await this.media.consume({
                roomId: session.rtcRoomId,
                peerId: userId,
                transportId: dto.transportId,
                producerId: dto.producerId,
                rtpCapabilities: dto.rtpCapabilities,
            });
            return { consumer };
        });
    }
    async resumeConsumer(client, dto) {
        return this.safe(async () => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            await this.media.resumeConsumer(roomId, userId, dto.consumerId);
            return {};
        });
    }
    async pauseConsumer(client, dto) {
        return this.safe(async () => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            await this.media.pauseConsumer(roomId, userId, dto.consumerId);
            return {};
        });
    }
    async setPreferredLayers(client, dto) {
        return this.safe(async () => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            await this.media.setPreferredLayers(roomId, userId, dto.consumerId, dto.spatialLayer, dto.temporalLayer);
            return {};
        });
    }
    async pauseProducer(client, dto) {
        return this.safe(async () => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            await this.media.pauseProducer(roomId, userId, dto.producerId);
            client.to(this.sessionRoom(dto.sessionId)).emit('rtc:producer-paused', { sessionId: dto.sessionId, producerId: dto.producerId, userId });
            return {};
        });
    }
    async resumeProducer(client, dto) {
        return this.safe(async () => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            await this.media.resumeProducer(roomId, userId, dto.producerId);
            client.to(this.sessionRoom(dto.sessionId)).emit('rtc:producer-resumed', { sessionId: dto.sessionId, producerId: dto.producerId, userId });
            return {};
        });
    }
    closeProducer(client, dto) {
        return this.safeSync(() => {
            const { roomId, userId } = this.liveContext(client, dto.sessionId);
            this.media.closeProducer(roomId, userId, dto.producerId);
            return {};
        });
    }
    liveContext(client, sessionId) {
        const userId = this.userId(client);
        const session = this.sessions.require(sessionId);
        this.sessions.requireParticipant(sessionId, userId);
        if (session.status !== 'LIVE' || !session.rtcRoomId)
            throw new Error('Session is not live');
        if (!this.rooms.getPeer(session.rtcRoomId, userId))
            throw new Error('RTC peer not joined');
        return { session, roomId: session.rtcRoomId, userId };
    }
    userId(client) {
        const userId = client.data.auth?.sub;
        if (!userId)
            throw new Error('Unauthenticated socket');
        return userId;
    }
    sessionRoom(sessionId) {
        return `session:${sessionId}`;
    }
    schedulePeerCleanup(sessionId, userId) {
        this.cancelPeerCleanup(sessionId, userId);
        const delay = Number(this.config.get('RTC_PEER_GRACE_MS') ?? 20_000);
        const key = `${sessionId}:${userId}`;
        const timer = setTimeout(() => {
            const session = this.sessions.get(sessionId);
            if (session?.rtcRoomId)
                this.rooms.closePeer(session.rtcRoomId, userId);
            this.disconnectTimers.delete(key);
            this.server.to(this.sessionRoom(sessionId)).emit('rtc:peer-left', { sessionId, userId });
        }, delay);
        timer.unref();
        this.disconnectTimers.set(key, timer);
    }
    cancelPeerCleanup(sessionId, userId) {
        const key = `${sessionId}:${userId}`;
        const timer = this.disconnectTimers.get(key);
        if (timer)
            clearTimeout(timer);
        this.disconnectTimers.delete(key);
    }
    async safe(fn) {
        try {
            return (0, types_1.ok)(await fn());
        }
        catch (error) {
            return (0, types_1.fail)(this.errorCode(error), error?.message ?? 'Request failed');
        }
    }
    safeSync(fn) {
        try {
            return (0, types_1.ok)(fn());
        }
        catch (error) {
            return (0, types_1.fail)(this.errorCode(error), error?.message ?? 'Request failed');
        }
    }
    errorCode(error) {
        const status = typeof error?.getStatus === 'function' ? error.getStatus() : undefined;
        if (status === 401)
            return 'UNAUTHORIZED';
        if (status === 403)
            return 'FORBIDDEN';
        if (status === 404)
            return 'NOT_FOUND';
        if (status === 409)
            return 'CONFLICT';
        return 'RTC_ERROR';
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Namespace)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('session:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.SessionJoinDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "joinSession", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('session:ready'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.SessionReadyDto]),
    __metadata("design:returntype", Object)
], RealtimeGateway.prototype, "ready", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('session:start'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.SessionIdDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "startSession", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('session:end'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.SessionIdDto]),
    __metadata("design:returntype", Object)
], RealtimeGateway.prototype, "endSession", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('session:leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.SessionIdDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "leaveSession", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('session:get-state'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.SessionIdDto]),
    __metadata("design:returntype", Object)
], RealtimeGateway.prototype, "getSessionState", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.RtcJoinDto]),
    __metadata("design:returntype", Object)
], RealtimeGateway.prototype, "rtcJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:create-transport'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.CreateTransportDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "createTransport", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:connect-transport'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.ConnectTransportDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "connectTransport", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:restart-ice'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.TransportIdDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "restartIce", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:close-transport'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.TransportIdDto]),
    __metadata("design:returntype", Object)
], RealtimeGateway.prototype, "closeTransport", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:produce'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.ProduceDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "produce", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:list-producers'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.SessionIdDto]),
    __metadata("design:returntype", Object)
], RealtimeGateway.prototype, "listProducers", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:consume'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.ConsumeDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "consume", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:resume-consumer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.ConsumerIdDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "resumeConsumer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:pause-consumer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.ConsumerIdDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "pauseConsumer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:set-preferred-layers'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.PreferredLayersDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "setPreferredLayers", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:pause-producer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.ProducerIdDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "pauseProducer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:resume-producer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.ProducerIdDto]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "resumeProducer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rtc:close-producer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, realtime_dto_1.ProducerIdDto]),
    __metadata("design:returntype", Object)
], RealtimeGateway.prototype, "closeProducer", null);
exports.RealtimeGateway = RealtimeGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/realtime',
        transports: ['websocket'],
        pingInterval: 25_000,
        pingTimeout: 60_000,
        perMessageDeflate: false,
        cors: { origin: true, credentials: true },
    }),
    __metadata("design:paramtypes", [config_1.ConfigService,
        auth_service_1.AuthService,
        session_service_1.SessionService,
        rtc_room_service_1.RtcRoomService,
        transport_service_1.TransportService,
        producer_consumer_service_1.ProducerConsumerService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map