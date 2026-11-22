import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { Ack, AuthClaims } from '../common/types';
import { SessionService } from './session.service';
import { RtcRoomService } from '../mediasoup/rtc-room.service';
import { TransportService } from '../mediasoup/transport.service';
import { ProducerConsumerService } from '../mediasoup/producer-consumer.service';
import { ConnectTransportDto, ConsumeDto, ConsumerIdDto, CreateTransportDto, PreferredLayersDto, ProduceDto, ProducerIdDto, RtcJoinDto, SessionIdDto, SessionJoinDto, SessionReadyDto, TransportIdDto } from './dto/realtime.dto';
interface AuthenticatedSocket extends Socket {
    data: {
        auth?: AuthClaims;
    } & Record<string, unknown>;
}
export declare class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly config;
    private readonly auth;
    private readonly sessions;
    private readonly rooms;
    private readonly transports;
    private readonly media;
    server: Namespace;
    private readonly memberships;
    private readonly disconnectTimers;
    constructor(config: ConfigService, auth: AuthService, sessions: SessionService, rooms: RtcRoomService, transports: TransportService, media: ProducerConsumerService);
    handleConnection(client: AuthenticatedSocket): Promise<void>;
    handleDisconnect(client: AuthenticatedSocket): void;
    joinSession(client: AuthenticatedSocket, dto: SessionJoinDto): Promise<Ack<any>>;
    ready(client: AuthenticatedSocket, dto: SessionReadyDto): Ack<any>;
    startSession(client: AuthenticatedSocket, dto: SessionIdDto): Promise<Ack<any>>;
    endSession(client: AuthenticatedSocket, dto: SessionIdDto): Ack<any>;
    leaveSession(client: AuthenticatedSocket, dto: SessionIdDto): Promise<Ack<any>>;
    getSessionState(client: AuthenticatedSocket, dto: SessionIdDto): Ack<any>;
    rtcJoin(client: AuthenticatedSocket, dto: RtcJoinDto): Ack<any>;
    createTransport(client: AuthenticatedSocket, dto: CreateTransportDto): Promise<Ack<any>>;
    connectTransport(client: AuthenticatedSocket, dto: ConnectTransportDto): Promise<Ack<any>>;
    restartIce(client: AuthenticatedSocket, dto: TransportIdDto): Promise<Ack<any>>;
    closeTransport(client: AuthenticatedSocket, dto: TransportIdDto): Ack<any>;
    produce(client: AuthenticatedSocket, dto: ProduceDto): Promise<Ack<any>>;
    listProducers(client: AuthenticatedSocket, dto: SessionIdDto): Ack<any>;
    consume(client: AuthenticatedSocket, dto: ConsumeDto): Promise<Ack<any>>;
    resumeConsumer(client: AuthenticatedSocket, dto: ConsumerIdDto): Promise<Ack<any>>;
    pauseConsumer(client: AuthenticatedSocket, dto: ConsumerIdDto): Promise<Ack<any>>;
    setPreferredLayers(client: AuthenticatedSocket, dto: PreferredLayersDto): Promise<Ack<any>>;
    pauseProducer(client: AuthenticatedSocket, dto: ProducerIdDto): Promise<Ack<any>>;
    resumeProducer(client: AuthenticatedSocket, dto: ProducerIdDto): Promise<Ack<any>>;
    closeProducer(client: AuthenticatedSocket, dto: ProducerIdDto): Ack<any>;
    private liveContext;
    private userId;
    private sessionRoom;
    private schedulePeerCleanup;
    private cancelPeerCleanup;
    private safe;
    private safeSync;
    private errorCode;
}
export {};
