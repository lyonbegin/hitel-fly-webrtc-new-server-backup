import { ConfigService } from '@nestjs/config';
import { RtcRoomService } from '../mediasoup/rtc-room.service';
import { CreateSessionInput, ParticipantPermissions, RealtimeSession, SessionParticipant } from './interfaces/session.types';
export declare class SessionService {
    private readonly config;
    private readonly rtcRooms;
    private readonly sessions;
    constructor(config: ConfigService, rtcRooms: RtcRoomService);
    create(input: CreateSessionInput): RealtimeSession;
    get(sessionId: string): RealtimeSession | undefined;
    require(sessionId: string): RealtimeSession;
    addParticipant(sessionId: string, participant: Omit<SessionParticipant, 'presence' | 'ready' | 'joinedAt' | 'lastSeenAt'>, actorUserId: string): SessionParticipant;
    removeParticipant(sessionId: string, userId: string, actorUserId: string): void;
    join(sessionId: string, userId: string): SessionParticipant;
    markReady(sessionId: string, userId: string, ready: boolean): SessionParticipant;
    start(sessionId: string, actorUserId: string): Promise<RealtimeSession>;
    end(sessionId: string, actorUserId: string): RealtimeSession;
    cancel(sessionId: string, actorUserId: string): RealtimeSession;
    leave(sessionId: string, userId: string): void;
    markDisconnected(sessionId: string, userId: string): void;
    requireParticipant(sessionId: string, userId: string): SessionParticipant;
    requirePermission(sessionId: string, userId: string, permission: keyof ParticipantPermissions): SessionParticipant;
    toPublic(session: RealtimeSession): {
        id: string;
        type: string;
        title: string | undefined;
        status: import("./interfaces/session.types").SessionStatus;
        hostUserIds: string[];
        participants: SessionParticipant[];
        policy: import("./interfaces/session.types").SessionPolicy;
        scheduledAt: string | undefined;
        createdAt: string;
        startedAt: string | undefined;
        endedAt: string | undefined;
        mediaNodeId: string | undefined;
        mediaNodePublicUrl: string | undefined;
        metadata: Record<string, unknown>;
    };
    findByRtcRoomId(rtcRoomId: string): RealtimeSession | undefined;
    listForUser(userId: string): RealtimeSession[];
    getStats(): {
        total: number;
        live: number;
        waiting: number;
    };
    private guestPermissions;
}
