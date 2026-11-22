import { ConfigService } from '@nestjs/config';
import type { DtlsParameters } from 'mediasoup/types';
import { MediasoupService } from './mediasoup.service';
import { RtcRoomService } from './rtc-room.service';
import { TransportDirection } from './rtc-room.types';
export declare class TransportService {
    private readonly config;
    private readonly mediasoup;
    private readonly rooms;
    constructor(config: ConfigService, mediasoup: MediasoupService, rooms: RtcRoomService);
    create(roomId: string, peerId: string, direction: TransportDirection): Promise<{
        id: any;
        iceParameters: any;
        iceCandidates: any;
        dtlsParameters: any;
        sctpParameters: any;
    }>;
    connect(roomId: string, peerId: string, transportId: string, dtlsParameters: DtlsParameters): Promise<void>;
    close(roomId: string, peerId: string, transportId: string): void;
    restartIce(roomId: string, peerId: string, transportId: string): Promise<import("mediasoup/types").IceParameters>;
    get(roomId: string, peerId: string, transportId: string, expected?: TransportDirection): import("mediasoup/types").WebRtcTransport<import("mediasoup/types").AppData>;
    private toClientOptions;
}
