import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Router, WebRtcServer, Worker } from 'mediasoup/types';
export interface WorkerSlot {
    index: number;
    worker: Worker;
    webRtcServer: WebRtcServer;
    port: number;
    routers: Set<string>;
}
export declare class MediasoupService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly logger;
    private readonly slots;
    private initialized;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private initialize;
    private resolveUdpListenIp;
    getLeastLoadedSlot(): WorkerSlot;
    getSlot(index: number): WorkerSlot;
    registerRouter(slotIndex: number, router: Router): void;
    getStats(): {
        initialized: boolean;
        workers: {
            index: number;
            pid: number;
            port: number;
            routers: number;
        }[];
    };
}
