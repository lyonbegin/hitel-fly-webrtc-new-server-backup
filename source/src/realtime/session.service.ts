import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RtcRoomService } from '../mediasoup/rtc-room.service';
import {
  CreateSessionInput,
  ParticipantPermissions,
  RealtimeSession,
  SessionParticipant,
} from './interfaces/session.types';

@Injectable()
export class SessionService {
  private readonly sessions = new Map<string, RealtimeSession>();

  constructor(
    private readonly config: ConfigService,
    private readonly rtcRooms: RtcRoomService,
  ) {}

  create(input: CreateSessionInput): RealtimeSession {
    const id = input.id ?? randomUUID();
    if (this.sessions.has(id)) throw new ConflictException('Session already exists');
    if (input.participants.length > input.policy.maxParticipants) {
      throw new ConflictException('Participant count exceeds session policy');
    }

    const participants = new Map<string, SessionParticipant>();
    for (const participant of input.participants) {
      if (participants.has(participant.userId)) throw new ConflictException(`Duplicate participant ${participant.userId}`);
      participants.set(participant.userId, {
        ...participant,
        presence: 'INVITED',
        ready: false,
      });
    }

    const session: RealtimeSession = {
      id,
      type: input.type,
      title: input.title,
      status: input.scheduledAt ? 'SCHEDULED' : 'WAITING',
      hostUserIds: input.hostUserIds ?? [],
      participants,
      policy: input.policy,
      scheduledAt: input.scheduledAt,
      createdAt: new Date().toISOString(),
      mediaNodeId: this.config.get<string>('MEDIA_NODE_ID') ?? 'media-local-1',
      metadata: input.metadata ?? {},
    };
    this.sessions.set(id, session);
    return session;
  }

  get(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  require(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  addParticipant(
    sessionId: string,
    participant: Omit<SessionParticipant, 'presence' | 'ready' | 'joinedAt' | 'lastSeenAt'>,
    actorUserId: string,
  ) {
    const session = this.require(sessionId);
    this.requirePermission(sessionId, actorUserId, 'manageParticipants');
    if (session.status === 'ENDED' || session.status === 'CANCELLED') throw new ConflictException('Session is closed');
    if (session.participants.has(participant.userId)) throw new ConflictException('Participant already exists');
    if (session.participants.size >= session.policy.maxParticipants) throw new ConflictException('Session is full');
    session.participants.set(participant.userId, { ...participant, presence: 'INVITED', ready: false });
    return session.participants.get(participant.userId)!;
  }

  removeParticipant(sessionId: string, userId: string, actorUserId: string) {
    const session = this.require(sessionId);
    this.requirePermission(sessionId, actorUserId, 'manageParticipants');
    if (session.hostUserIds.includes(userId)) throw new ForbiddenException('Cannot remove a host');
    session.participants.delete(userId);
    if (session.rtcRoomId) this.rtcRooms.closePeer(session.rtcRoomId, userId);
  }

  join(sessionId: string, userId: string): SessionParticipant {
    const session = this.require(sessionId);
    if (session.status === 'ENDED' || session.status === 'CANCELLED') {
      if (!session.policy.allowRejoinAfterEnd) throw new ForbiddenException('Session is closed');
    }

    let participant = session.participants.get(userId);
    if (!participant) {
      if (!session.policy.allowUnlistedParticipants) throw new ForbiddenException('Not invited to this session');
      if (session.participants.size >= session.policy.maxParticipants) throw new ForbiddenException('Session is full');
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
    if (session.status === 'SCHEDULED') session.status = 'WAITING';
    return participant;
  }

  markReady(sessionId: string, userId: string, ready: boolean) {
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
    if (present.length > 0 && present.every((p) => p.ready)) session.status = 'READY';
    else session.status = 'WAITING';
    return participant;
  }

  async start(sessionId: string, actorUserId: string) {
    const session = this.require(sessionId);
    this.requirePermission(sessionId, actorUserId, 'manageSession');
    if (session.policy.requireHostStart && !session.hostUserIds.includes(actorUserId)) {
      throw new ForbiddenException('Only a session host can start this session');
    }
    if (session.status === 'ENDED' || session.status === 'CANCELLED') throw new ConflictException('Session is closed');
    if (session.status === 'LIVE') return session;

    const rtcRoomId = `rtc_${randomUUID()}`;
    await this.rtcRooms.create(rtcRoomId);
    session.rtcRoomId = rtcRoomId;
    session.status = 'LIVE';
    session.startedAt = new Date().toISOString();
    for (const participant of session.participants.values()) {
      if (participant.presence !== 'INVITED' && participant.presence !== 'LEFT') participant.presence = 'LIVE';
    }
    return session;
  }

  end(sessionId: string, actorUserId: string) {
    const session = this.require(sessionId);
    this.requirePermission(sessionId, actorUserId, 'manageSession');
    if (session.rtcRoomId) this.rtcRooms.closeRoom(session.rtcRoomId);
    session.status = 'ENDED';
    session.endedAt = new Date().toISOString();
    for (const participant of session.participants.values()) participant.presence = 'LEFT';
    return session;
  }

  cancel(sessionId: string, actorUserId: string) {
    const session = this.require(sessionId);
    this.requirePermission(sessionId, actorUserId, 'manageSession');
    if (session.rtcRoomId) this.rtcRooms.closeRoom(session.rtcRoomId);
    session.status = 'CANCELLED';
    session.endedAt = new Date().toISOString();
    return session;
  }

  leave(sessionId: string, userId: string) {
    const session = this.require(sessionId);
    const participant = this.requireParticipant(sessionId, userId);
    participant.ready = false;
    participant.presence = 'LEFT';
    participant.lastSeenAt = Date.now();
    if (session.rtcRoomId) this.rtcRooms.closePeer(session.rtcRoomId, userId);
  }

  markDisconnected(sessionId: string, userId: string) {
    const session = this.sessions.get(sessionId);
    const participant = session?.participants.get(userId);
    if (!participant || participant.presence === 'LEFT') return;
    participant.presence = 'DISCONNECTED';
    participant.lastSeenAt = Date.now();
  }

  requireParticipant(sessionId: string, userId: string) {
    const session = this.require(sessionId);
    const participant = session.participants.get(userId);
    if (!participant) throw new ForbiddenException('Not a session participant');
    return participant;
  }

  requirePermission(sessionId: string, userId: string, permission: keyof ParticipantPermissions) {
    const participant = this.requireParticipant(sessionId, userId);
    if (!participant.permissions[permission]) throw new ForbiddenException(`Missing permission: ${permission}`);
    return participant;
  }

  toPublic(session: RealtimeSession) {
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
      mediaNodePublicUrl: this.config.get<string>('MEDIA_NODE_PUBLIC_URL') ?? undefined,
      metadata: session.metadata,
    };
  }

  findByRtcRoomId(rtcRoomId: string) {
    return [...this.sessions.values()].find((session) => session.rtcRoomId === rtcRoomId);
  }

  listForUser(userId: string) {
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

  private guestPermissions(): ParticipantPermissions {
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
}
