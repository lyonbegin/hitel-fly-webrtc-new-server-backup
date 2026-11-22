import type { RtpCapabilities } from 'mediasoup/types';
import { MediasoupService } from './mediasoup.service';
import { RtcPeer, RtcRoom } from './rtc-room.types';
export declare class RtcRoomService {
    private readonly mediasoup;
    private readonly logger;
    private readonly rooms;
    constructor(mediasoup: MediasoupService);
    create(roomId: string): Promise<RtcRoom>;
    get(roomId: string): RtcRoom | undefined;
    require(roomId: string): RtcRoom;
    getRtpCapabilities(roomId: string): RtpCapabilities;
    upsertPeer(roomId: string, input: Omit<RtcPeer, 'transports' | 'producers' | 'consumers' | 'joinedAt'>): RtcPeer;
    getPeer(roomId: string, peerId: string): RtcPeer | undefined;
    markPeerDisconnected(roomId: string, peerId: string): void;
    closePeer(roomId: string, peerId: string): void;
    closeRoom(roomId: string): void;
    listRooms(): RtcRoom[];
}
