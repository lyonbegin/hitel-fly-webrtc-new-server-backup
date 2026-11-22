import { MediasoupService } from '../mediasoup/mediasoup.service';
import { SessionService } from '../realtime/session.service';
export declare class HealthController {
    private readonly mediasoup;
    private readonly sessions;
    constructor(mediasoup: MediasoupService, sessions: SessionService);
    getHealth(): {
        ok: boolean;
        uptimeSec: number;
        mediasoup: {
            initialized: boolean;
            workers: {
                index: number;
                pid: number;
                port: number;
                routers: number;
            }[];
        };
        sessions: {
            total: number;
            live: number;
            waiting: number;
        };
        timestamp: string;
    };
}
