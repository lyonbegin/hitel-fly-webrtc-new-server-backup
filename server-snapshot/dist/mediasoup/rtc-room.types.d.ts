import type { Consumer, MediaKind, Producer, Router, WebRtcTransport } from 'mediasoup/types';
export type TransportDirection = 'send' | 'recv';
export interface RtcTransportEntry {
    direction: TransportDirection;
    transport: WebRtcTransport;
}
export interface RtcProducerEntry {
    producer: Producer;
    source: 'camera' | 'microphone' | 'screen' | 'unknown';
}
export interface RtcConsumerEntry {
    consumer: Consumer;
    producerPeerId: string;
}
export interface RtcPeer {
    peerId: string;
    userId: string;
    socketId?: string;
    displayName?: string;
    role?: string;
    connected: boolean;
    joinedAt: number;
    transports: Map<string, RtcTransportEntry>;
    producers: Map<string, RtcProducerEntry>;
    consumers: Map<string, RtcConsumerEntry>;
}
export interface RtcRoom {
    id: string;
    workerIndex: number;
    router: Router;
    peers: Map<string, RtcPeer>;
    createdAt: number;
}
export interface ProducerDescriptor {
    producerId: string;
    peerId: string;
    userId: string;
    kind: MediaKind;
    source: string;
    appData: Record<string, unknown>;
}
