import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { Ack, AuthClaims, fail, ok } from '../common/types';
import { SessionService } from './session.service';
import { RtcRoomService } from '../mediasoup/rtc-room.service';
import { TransportService } from '../mediasoup/transport.service';
import { ProducerConsumerService } from '../mediasoup/producer-consumer.service';
import {
  ConnectTransportDto,
  ConsumeDto,
  ConsumerIdDto,
  CreateTransportDto,
  PreferredLayersDto,
  ProduceDto,
  ProducerIdDto,
  RtcJoinDto,
  SessionIdDto,
  SessionJoinDto,
  SessionReadyDto,
  TransportIdDto,
} from './dto/realtime.dto';

interface AuthenticatedSocket extends Socket {
  data: { auth?: AuthClaims } & Record<string, unknown>;
}

@WebSocketGateway({
  namespace: '/realtime',
  transports: ['websocket'],
  pingInterval: 25_000,
  pingTimeout: 60_000,
  perMessageDeflate: false,
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Namespace;

  private readonly memberships = new Map<string, Set<string>>();
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly rooms: RtcRoomService,
    private readonly transports: TransportService,
    private readonly media: ProducerConsumerService,
  ) {
    this.media.events.on('producerClosed', (event: { roomId: string; peerId: string; userId: string; producerId: string; kind: string; source: string }) => {
      const session = this.sessions.findByRtcRoomId(event.roomId);
      if (!session || !this.server) return;
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

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const handshakeToken = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : undefined;
      const headerToken = this.auth.extractBearer(client.handshake.headers.authorization);
      client.data.auth = await this.auth.verify(handshakeToken ?? headerToken);
      this.memberships.set(client.id, new Set());
      client.emit('connection:ready', { userId: client.data.auth.sub, socketId: client.id });
    } catch (error: any) {
      client.emit('connection:error', { code: 'UNAUTHORIZED', message: error?.message ?? 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.auth?.sub;
    if (!userId) return;
    const sessionIds = this.memberships.get(client.id) ?? new Set<string>();
    this.memberships.delete(client.id);

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (!session) continue;
      this.sessions.markDisconnected(sessionId, userId);
      if (session.rtcRoomId) this.rooms.markPeerDisconnected(session.rtcRoomId, userId);
      this.server.to(this.sessionRoom(sessionId)).emit('session:participant-disconnected', { sessionId, userId });
      this.schedulePeerCleanup(sessionId, userId);
    }
  }

  @SubscribeMessage('session:join')
  async joinSession(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: SessionJoinDto): Promise<Ack<any>> {
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

  @SubscribeMessage('session:ready')
  ready(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: SessionReadyDto): Ack<any> {
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

  @SubscribeMessage('session:start')
  async startSession(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: SessionIdDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const session = await this.sessions.start(dto.sessionId, this.userId(client));
      const publicSession = this.sessions.toPublic(session);
      this.server.to(this.sessionRoom(dto.sessionId)).emit('session:started', { session: publicSession });
      return { session: publicSession };
    });
  }

  @SubscribeMessage('session:end')
  endSession(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: SessionIdDto): Ack<any> {
    return this.safeSync(() => {
      const session = this.sessions.end(dto.sessionId, this.userId(client));
      const publicSession = this.sessions.toPublic(session);
      this.server.to(this.sessionRoom(dto.sessionId)).emit('session:ended', { session: publicSession });
      return { session: publicSession };
    });
  }

  @SubscribeMessage('session:leave')
  async leaveSession(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: SessionIdDto): Promise<Ack<any>> {
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

  @SubscribeMessage('session:get-state')
  getSessionState(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: SessionIdDto): Ack<any> {
    return this.safeSync(() => {
      this.sessions.requireParticipant(dto.sessionId, this.userId(client));
      return { session: this.sessions.toPublic(this.sessions.require(dto.sessionId)) };
    });
  }

  @SubscribeMessage('rtc:join')
  rtcJoin(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: RtcJoinDto): Ack<any> {
    return this.safeSync(() => {
      const userId = this.userId(client);
      const session = this.sessions.require(dto.sessionId);
      const participant = this.sessions.requireParticipant(dto.sessionId, userId);
      if (session.status !== 'LIVE' || !session.rtcRoomId) throw new Error('Session is not live');

      const existing = this.rooms.getPeer(session.rtcRoomId, userId);
      let resumed = false;
      if (existing) {
        if (dto.resume && !existing.connected) {
          existing.socketId = client.id;
          existing.connected = true;
          resumed = true;
        } else if (existing.socketId !== client.id) {
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

  @SubscribeMessage('rtc:create-transport')
  async createTransport(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: CreateTransportDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      if (dto.direction !== 'send' && dto.direction !== 'recv') throw new Error('Invalid transport direction');
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

  @SubscribeMessage('rtc:connect-transport')
  async connectTransport(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: ConnectTransportDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      await this.transports.connect(roomId, userId, dto.transportId, dto.dtlsParameters);
      return {};
    });
  }

  @SubscribeMessage('rtc:restart-ice')
  async restartIce(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: TransportIdDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      const iceParameters = await this.transports.restartIce(roomId, userId, dto.transportId);
      return { iceParameters };
    });
  }

  @SubscribeMessage('rtc:close-transport')
  closeTransport(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: TransportIdDto): Ack<any> {
    return this.safeSync(() => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      this.transports.close(roomId, userId, dto.transportId);
      return {};
    });
  }

  @SubscribeMessage('rtc:produce')
  async produce(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: ProduceDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const userId = this.userId(client);
      const session = this.sessions.require(dto.sessionId);
      if (!session.rtcRoomId || session.status !== 'LIVE') throw new Error('Session is not live');
      const source = typeof dto.appData?.source === 'string' ? dto.appData.source : undefined;
      if (source === 'screen') this.sessions.requirePermission(dto.sessionId, userId, 'shareScreen');
      if (dto.kind === 'audio') this.sessions.requirePermission(dto.sessionId, userId, 'publishAudio');
      if (dto.kind === 'video' && source !== 'screen') this.sessions.requirePermission(dto.sessionId, userId, 'publishVideo');

      const existingPeer = this.rooms.getPeer(session.rtcRoomId, userId);
      const alreadyPublishingKind = [...(existingPeer?.producers.values() ?? [])].some(
        (entry) => entry.producer.kind === dto.kind,
      );
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

  @SubscribeMessage('rtc:list-producers')
  listProducers(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: SessionIdDto): Ack<any> {
    return this.safeSync(() => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      return { producers: this.media.listOtherProducers(roomId, userId) };
    });
  }

  @SubscribeMessage('rtc:consume')
  async consume(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: ConsumeDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const userId = this.userId(client);
      const session = this.sessions.require(dto.sessionId);
      if (!session.rtcRoomId || session.status !== 'LIVE') throw new Error('Session is not live');
      const target = this.media.getProducer(session.rtcRoomId, dto.producerId);
      if (target.entry.producer.kind === 'audio') this.sessions.requirePermission(dto.sessionId, userId, 'consumeAudio');
      if (target.entry.producer.kind === 'video') this.sessions.requirePermission(dto.sessionId, userId, 'consumeVideo');
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

  @SubscribeMessage('rtc:resume-consumer')
  async resumeConsumer(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: ConsumerIdDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      await this.media.resumeConsumer(roomId, userId, dto.consumerId);
      return {};
    });
  }

  @SubscribeMessage('rtc:pause-consumer')
  async pauseConsumer(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: ConsumerIdDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      await this.media.pauseConsumer(roomId, userId, dto.consumerId);
      return {};
    });
  }

  @SubscribeMessage('rtc:set-preferred-layers')
  async setPreferredLayers(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: PreferredLayersDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      await this.media.setPreferredLayers(roomId, userId, dto.consumerId, dto.spatialLayer, dto.temporalLayer);
      return {};
    });
  }

  @SubscribeMessage('rtc:pause-producer')
  async pauseProducer(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: ProducerIdDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      await this.media.pauseProducer(roomId, userId, dto.producerId);
      client.to(this.sessionRoom(dto.sessionId)).emit('rtc:producer-paused', { sessionId: dto.sessionId, producerId: dto.producerId, userId });
      return {};
    });
  }

  @SubscribeMessage('rtc:resume-producer')
  async resumeProducer(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: ProducerIdDto): Promise<Ack<any>> {
    return this.safe(async () => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      await this.media.resumeProducer(roomId, userId, dto.producerId);
      client.to(this.sessionRoom(dto.sessionId)).emit('rtc:producer-resumed', { sessionId: dto.sessionId, producerId: dto.producerId, userId });
      return {};
    });
  }

  @SubscribeMessage('rtc:close-producer')
  closeProducer(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: ProducerIdDto): Ack<any> {
    return this.safeSync(() => {
      const { roomId, userId } = this.liveContext(client, dto.sessionId);
      this.media.closeProducer(roomId, userId, dto.producerId);
      return {};
    });
  }

  private liveContext(client: AuthenticatedSocket, sessionId: string) {
    const userId = this.userId(client);
    const session = this.sessions.require(sessionId);
    this.sessions.requireParticipant(sessionId, userId);
    if (session.status !== 'LIVE' || !session.rtcRoomId) throw new Error('Session is not live');
    if (!this.rooms.getPeer(session.rtcRoomId, userId)) throw new Error('RTC peer not joined');
    return { session, roomId: session.rtcRoomId, userId };
  }

  private userId(client: AuthenticatedSocket) {
    const userId = client.data.auth?.sub;
    if (!userId) throw new Error('Unauthenticated socket');
    return userId;
  }

  private sessionRoom(sessionId: string) {
    return `session:${sessionId}`;
  }

  private schedulePeerCleanup(sessionId: string, userId: string) {
    this.cancelPeerCleanup(sessionId, userId);
    const delay = Number(this.config.get<string>('RTC_PEER_GRACE_MS') ?? 20_000);
    const key = `${sessionId}:${userId}`;
    const timer = setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session?.rtcRoomId) this.rooms.closePeer(session.rtcRoomId, userId);
      this.disconnectTimers.delete(key);
      this.server.to(this.sessionRoom(sessionId)).emit('rtc:peer-left', { sessionId, userId });
    }, delay);
    timer.unref();
    this.disconnectTimers.set(key, timer);
  }

  private cancelPeerCleanup(sessionId: string, userId: string) {
    const key = `${sessionId}:${userId}`;
    const timer = this.disconnectTimers.get(key);
    if (timer) clearTimeout(timer);
    this.disconnectTimers.delete(key);
  }

  private async safe<T>(fn: () => Promise<T>): Promise<Ack<T>> {
    try { return ok(await fn()); }
    catch (error: any) { return fail(this.errorCode(error), error?.message ?? 'Request failed'); }
  }

  private safeSync<T>(fn: () => T): Ack<T> {
    try { return ok(fn()); }
    catch (error: any) { return fail(this.errorCode(error), error?.message ?? 'Request failed'); }
  }

  private errorCode(error: any) {
    const status = typeof error?.getStatus === 'function' ? error.getStatus() : undefined;
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    return 'RTC_ERROR';
  }
}
