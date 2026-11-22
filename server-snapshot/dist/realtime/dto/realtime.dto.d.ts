export declare class SessionJoinDto {
    sessionId: string;
}
export declare class SessionReadyDto {
    sessionId: string;
    ready: boolean;
}
export declare class SessionIdDto {
    sessionId: string;
}
export declare class RtcJoinDto {
    sessionId: string;
    resume?: boolean;
}
export declare class CreateTransportDto {
    sessionId: string;
    direction: 'send' | 'recv';
}
export declare class ConnectTransportDto {
    sessionId: string;
    transportId: string;
    dtlsParameters: any;
}
export declare class ProduceDto {
    sessionId: string;
    transportId: string;
    kind: 'audio' | 'video';
    rtpParameters: any;
    appData?: Record<string, unknown>;
}
export declare class ConsumeDto {
    sessionId: string;
    transportId: string;
    producerId: string;
    rtpCapabilities: any;
}
export declare class ConsumerIdDto {
    sessionId: string;
    consumerId: string;
}
export declare class TransportIdDto {
    sessionId: string;
    transportId: string;
}
export declare class ProducerIdDto {
    sessionId: string;
    producerId: string;
}
export declare class PreferredLayersDto extends ConsumerIdDto {
    spatialLayer: number;
    temporalLayer?: number;
}
