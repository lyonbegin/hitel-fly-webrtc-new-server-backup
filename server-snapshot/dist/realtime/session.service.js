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
exports.SessionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const rtc_room_service_1 = require("../mediasoup/rtc-room.service");
let SessionService = class SessionService {
    config;
    rtcRooms;
    sessions = new Map();
    constructor(config, rtcRooms) {
        this.config = config;
        this.rtcRooms = rtcRooms;
    }
    create(input) {
        const id = input.id ?? (0, crypto_1.randomUUID)();
        if (this.sessions.has(id))
            throw new common_1.ConflictException('Session already exists');
        if (input.participants.length > input.policy.maxParticipants) {
            throw new common_1.ConflictException('Participant count exceeds session policy');
        }
        const participants = new Map();
        for (const participant of input.participants) {
            if (participants.has(participant.userId))
                throw new common_1.ConflictException(`Duplicate participant ${participant.userId}`);
            participants.set(participant.userId, {
                ...participant,
                presence: 'INVITED',
                ready: false,
            });
        }
        const session = {
            id,
            type: input.type,
            title: input.title,
            status: input.scheduledAt ? 'SCHEDULED' : 'WAITING',
            hostUserIds: input.hostUserIds ?? [],
            participants,
            policy: input.policy,
            scheduledAt: input.scheduledAt,
            createdAt: new Date().toISOString(),
            mediaNodeId: this.config.get('MEDIA_NODE_ID') ?? 'media-local-1',
            metadata: input.metadata ?? {},
        };
        this.sessions.set(id, session);
        return session;
    }
    get(sessionId) {
        return this.sessions.get(sessionId);
    }
    require(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new common_1.NotFoundException('Session not found');
        return session;
    }
    addParticipant(sessionId, participant, actorUserId) {
        const session = this.require(sessionId);
        this.requirePermission(sessionId, actorUserId, 'manageParticipants');
        if (session.status === 'ENDED' || session.status === 'CANCELLED')
            throw new common_1.ConflictException('Session is closed');
        if (session.participants.has(participant.userId))
            throw new common_1.ConflictException('Participant already exists');
        if (session.participants.size >= session.policy.maxParticipants)
            throw new common_1.ConflictException('Session is full');
        session.participants.set(participant.userId, { ...participant, presence: 'INVITED', ready: false });
        return session.participants.get(participant.userId);
    }
    removeParticipant(sessionId, userId, actorUserId) {
        const session = this.require(sessionId);
        this.requirePermission(sessionId, actorUserId, 'manageParticipants');
        if (session.hostUserIds.includes(userId))
            throw new common_1.ForbiddenException('Cannot remove a host');
        session.participants.delete(userId);
        if (session.rtcRoomId)
            this.rtcRooms.closePeer(session.rtcRoomId, userId);
    }
    join(sessionId, userId) {
        const session = this.require(sessionId);
        if (session.status === 'ENDED' || session.status === 'CANCELLED') {
            if (!session.policy.allowRejoinAfterEnd)
                throw new common_1.ForbiddenException('Session is closed');
        }
        let participant = session.participants.get(userId);
        if (!participant) {
            if (!session.policy.allowUnlistedParticipants)
                throw new common_1.ForbiddenException('Not invited to this session');
            if (session.participants.size >= session.policy.maxParticipants)
                throw new common_1.ForbiddenException('Session is full');
            participant = {
                userId,
                role: 'GUEST',
                permissions: this.guestPermissions(),
                presence: 'INVITED',
                ready: false,
            };
            session.participants.set(userId, participant);
        }
        participant.joinedAt ??= Date.now();
        participant.lastSeenAt = Date.now();
        participant.presence = session.status === 'LIVE' ? 'LIVE' : 'WAITING';
        if (session.status === 'SCHEDULED')
            session.status = 'WAITING';
        return participant;
    }
    markReady(sessionId, userId, ready) {
        const session = this.require(sessionId);
        const participant = this.requireParticipant(sessionId, userId);
        participant.ready = ready;
        participant.lastSeenAt = Date.now();
        if (session.status === 'LIVE') {
            participant.presence = 'LIVE';
            return participant;
        }
        participant.presence = ready ? 'READY' : 'WAITING';
        const present = [...session.participants.values()].filter((p) => p.presence !== 'INVITED' && p.presence !== 'LEFT');
        if (present.length > 0 && present.every((p) => p.ready))
            session.status = 'READY';
        else
            session.status = 'WAITING';
        return participant;
    }
    async start(sessionId, actorUserId) {
        const session = this.require(sessionId);
        this.requirePermission(sessionId, actorUserId, 'manageSession');
        if (session.policy.requireHostStart && !session.hostUserIds.includes(actorUserId)) {
            throw new common_1.ForbiddenException('Only a session host can start this session');
        }
        if (session.status === 'ENDED' || session.status === 'CANCELLED')
            throw new common_1.ConflictException('Session is closed');
        if (session.status === 'LIVE')
            return session;
        const rtcRoomId = `rtc_${(0, crypto_1.randomUUID)()}`;
        await this.rtcRooms.create(rtcRoomId);
        session.rtcRoomId = rtcRoomId;
        session.status = 'LIVE';
        session.startedAt = new Date().toISOString();
        for (const participant of session.participants.values()) {
            if (participant.presence !== 'INVITED' && participant.presence !== 'LEFT')
                participant.presence = 'LIVE';
        }
        return session;
    }
    end(sessionId, actorUserId) {
        const session = this.require(sessionId);
        this.requirePermission(sessionId, actorUserId, 'manageSession');
        if (session.rtcRoomId)
            this.rtcRooms.closeRoom(session.rtcRoomId);
        session.status = 'ENDED';
        session.endedAt = new Date().toISOString();
        for (const participant of session.participants.values())
            participant.presence = 'LEFT';
        return session;
    }
    cancel(sessionId, actorUserId) {
        const session = this.require(sessionId);
        this.requirePermission(sessionId, actorUserId, 'manageSession');
        if (session.rtcRoomId)
            this.rtcRooms.closeRoom(session.rtcRoomId);
        session.status = 'CANCELLED';
        session.endedAt = new Date().toISOString();
        return session;
    }
    leave(sessionId, userId) {
        const session = this.require(sessionId);
        const participant = this.requireParticipant(sessionId, userId);
        participant.ready = false;
        participant.presence = 'LEFT';
        participant.lastSeenAt = Date.now();
        if (session.rtcRoomId)
            this.rtcRooms.closePeer(session.rtcRoomId, userId);
    }
    markDisconnected(sessionId, userId) {
        const session = this.sessions.get(sessionId);
        const participant = session?.participants.get(userId);
        if (!participant || participant.presence === 'LEFT')
            return;
        participant.presence = 'DISCONNECTED';
        participant.lastSeenAt = Date.now();
    }
    requireParticipant(sessionId, userId) {
        const session = this.require(sessionId);
        const participant = session.participants.get(userId);
        if (!participant)
            throw new common_1.ForbiddenException('Not a session participant');
        return participant;
    }
    requirePermission(sessionId, userId, permission) {
        const participant = this.requireParticipant(sessionId, userId);
        if (!participant.permissions[permission])
            throw new common_1.ForbiddenException(`Missing permission: ${permission}`);
        return participant;
    }
    toPublic(session) {
        return {
            id: session.id,
            type: session.type,
            title: session.title,
            status: session.status,
            hostUserIds: session.hostUserIds,
            participants: [...session.participants.values()],
            policy: session.policy,
            scheduledAt: session.scheduledAt,
            createdAt: session.createdAt,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            mediaNodeId: session.mediaNodeId,
            mediaNodePublicUrl: this.config.get('MEDIA_NODE_PUBLIC_URL') ?? undefined,
            metadata: session.metadata,
        };
    }
    findByRtcRoomId(rtcRoomId) {
        return [...this.sessions.values()].find((session) => session.rtcRoomId === rtcRoomId);
    }
    listForUser(userId) {
        return [...this.sessions.values()].filter((session) => session.participants.has(userId));
    }
    getStats() {
        const sessions = [...this.sessions.values()];
        return {
            total: sessions.length,
            live: sessions.filter((s) => s.status === 'LIVE').length,
            waiting: sessions.filter((s) => s.status === 'WAITING' || s.status === 'READY').length,
        };
    }
    guestPermissions() {
        return {
            publishAudio: true,
            publishVideo: true,
            consumeAudio: true,
            consumeVideo: true,
            shareScreen: false,
            manageSession: false,
            manageParticipants: false,
        };
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        rtc_room_service_1.RtcRoomService])
], SessionService);
//# sourceMappingURL=session.service.js.map