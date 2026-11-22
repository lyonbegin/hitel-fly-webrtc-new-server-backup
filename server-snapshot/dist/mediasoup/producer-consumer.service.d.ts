import { EventEmitter } from 'events';
import type { MediaKind, RtpCapabilities, RtpParameters } from 'mediasoup/types';
import { RtcRoomService } from './rtc-room.service';
import { TransportService } from './transport.service';
import { ProducerDescriptor } from './rtc-room.types';
export declare class ProducerConsumerService {
    private readonly rooms;
    private readonly transports;
    readonly events: EventEmitter<[never]>;
    constructor(rooms: RtcRoomService, transports: TransportService);
    produce(input: {
        roomId: string;
        peerId: string;
        transportId: string;
        kind: MediaKind;
        rtpParameters: RtpParameters;
        appData?: Record<string, unknown>;
    }): Promise<ProducerDescriptor>;
    getProducer(roomId: string, producerId: string): {
        peer: import("./rtc-room.types").RtcPeer;
        entry: import("./rtc-room.types").RtcProducerEntry;
    };
    consume(input: {
        roomId: string;
        peerId: string;
        transportId: string;
        producerId: string;
        rtpCapabilities: RtpCapabilities;
    }): Promise<{
        id: string;
        producerId: string;
        producerPeerId: string;
        producerUserId: string;
        kind: MediaKind;
        rtpParameters: RtpParameters;
        type: import("mediasoup/types").ConsumerType;
        appData: {
            producerPeerId: string;
            producerUserId: string;
        };
        producerPaused: boolean;
    }>;
    resumeConsumer(roomId: string, peerId: string, consumerId: string): Promise<void>;
    pauseConsumer(roomId: string, peerId: string, consumerId: string): Promise<void>;
    setPreferredLayers(roomId: string, peerId: string, consumerId: string, spatialLayer: number, temporalLayer?: number): Promise<void>;
    pauseProducer(roomId: string, peerId: string, producerId: string): Promise<void>;
    resumeProducer(roomId: string, peerId: string, producerId: string): Promise<void>;
    closeProducer(roomId: string, peerId: string, producerId: string): void;
    countPublishingPeers(roomId: string, kind: MediaKind): number;
    listOtherProducers(roomId: string, peerId: string): ProducerDescriptor[];
    private getSource;
}
