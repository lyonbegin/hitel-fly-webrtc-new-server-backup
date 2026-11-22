export type SessionStatus = 'SCHEDULED' | 'WAITING' | 'READY' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type ParticipantPresence = 'INVITED' | 'WAITING' | 'READY' | 'LIVE' | 'DISCONNECTED' | 'LEFT';
export interface ParticipantPermissions {
    publishAudio: boolean;
    publishVideo: boolean;
    consumeAudio: boolean;
    consumeVideo: boolean;
    shareScreen: boolean;
    manageSession: boolean;
    manageParticipants: boolean;
}
export interface SessionParticipant {
    userId: string;
    displayName?: string;
    role: string;
    permissions: ParticipantPermissions;
    presence: ParticipantPresence;
    ready: boolean;
    joinedAt?: number;
    lastSeenAt?: number;
}
export type SessionTopology = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
export interface SessionPolicy {
    topology: SessionTopology;
    maxParticipants: number;
    maxVideoPublishers?: number;
    maxAudioPublishers?: number;
    waitingRoom: boolean;
    requireHostStart: boolean;
    allowUnlistedParticipants: boolean;
    allowRejoinAfterEnd: boolean;
}
export interface RealtimeSession {
    id: string;
    type: string;
    title?: string;
    status: SessionStatus;
    hostUserIds: string[];
    participants: Map<string, SessionParticipant>;
    policy: SessionPolicy;
    scheduledAt?: string;
    createdAt: string;
    startedAt?: string;
    endedAt?: string;
    rtcRoomId?: string;
    mediaNodeId?: string;
    metadata: Record<string, unknown>;
}
export interface CreateSessionInput {
    id?: string;
    type: string;
    title?: string;
    hostUserIds?: string[];
    participants: Array<Omit<SessionParticipant, 'presence' | 'ready' | 'joinedAt' | 'lastSeenAt'>>;
    policy: SessionPolicy;
    scheduledAt?: string;
    metadata?: Record<string, unknown>;
}
