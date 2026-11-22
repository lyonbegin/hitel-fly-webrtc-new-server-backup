"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MediasoupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasoupService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mediasoup = __importStar(require("mediasoup"));
const os = __importStar(require("os"));
const promises_1 = require("node:dns/promises");
let MediasoupService = MediasoupService_1 = class MediasoupService {
    config;
    logger = new common_1.Logger(MediasoupService_1.name);
    slots = [];
    initialized = false;
    constructor(config) {
        this.config = config;
    }
    async onModuleInit() {
        await this.initialize();
    }
    async onModuleDestroy() {
        for (const slot of this.slots) {
            try {
                slot.webRtcServer.close();
            }
            catch { }
            try {
                slot.worker.close();
            }
            catch { }
        }
        this.slots.length = 0;
        this.initialized = false;
    }
    async initialize() {
        const cpuCount = Math.max(1, os.cpus().length);
        const configured = Number(this.config.get('MEDIASOUP_WORKERS') ?? cpuCount);
        const maxWorkers = Number(this.config.get('MEDIASOUP_MAX_WORKERS') ?? 4);
        const workerCount = Math.max(1, Math.min(configured, cpuCount, maxWorkers));
        const tcpListenIp = this.config.get('MEDIASOUP_LISTEN_IP') ?? '0.0.0.0';
        const announcedAddress = this.config.get('MEDIASOUP_ANNOUNCED_ADDRESS') ?? '127.0.0.1';
        const portBase = Number(this.config.get('MEDIASOUP_WEBRTC_PORT_BASE') ?? 40000);
        const logLevel = (this.config.get('MEDIASOUP_LOG_LEVEL') ?? 'warn');
        const udpListenIp = await this.resolveUdpListenIp(tcpListenIp);
        this.logger.log(`mediasoup network: UDP=${udpListenIp}, TCP=${tcpListenIp}, announced=${announcedAddress}`);
        for (let index = 0; index < workerCount; index += 1) {
            const worker = await mediasoup.createWorker({
                logLevel,
                logTags: ['ice', 'dtls', 'rtp', 'rtcp', 'srtp'],
            });
            worker.on('died', (error) => {
                this.logger.error(`mediasoup worker ${index} died`, error?.stack ?? String(error));
                setTimeout(() => process.exit(1), 1000).unref();
            });
            const port = portBase + index;
            const webRtcServer = await worker.createWebRtcServer({
                listenInfos: [
                    {
                        protocol: 'udp',
                        ip: udpListenIp,
                        announcedAddress,
                        port,
                    },
                    {
                        protocol: 'tcp',
                        ip: tcpListenIp,
                        announcedAddress,
                        port,
                    },
                ],
                appData: { workerIndex: index, port },
            });
            this.slots.push({ index, worker, webRtcServer, port, routers: new Set() });
            this.logger.log(`worker ${index} ready; shared WebRtcServer UDP/TCP :${port}`);
        }
        this.initialized = true;
    }
    async resolveUdpListenIp(localFallback) {
        if (!process.env.FLY_APP_NAME)
            return localFallback;
        try {
            const result = await (0, promises_1.lookup)('fly-global-services', { family: 4 });
            this.logger.log(`Fly UDP bind address resolved: ${result.address}`);
            return result.address;
        }
        catch (error) {
            this.logger.error('Failed to resolve fly-global-services. UDP WebRTC cannot start safely on Fly.', error instanceof Error ? error.stack : String(error));
            throw error;
        }
    }
    getLeastLoadedSlot() {
        if (!this.initialized || this.slots.length === 0) {
            throw new Error('mediasoup is not initialized');
        }
        return [...this.slots].sort((a, b) => a.routers.size - b.routers.size)[0];
    }
    getSlot(index) {
        const slot = this.slots.find((item) => item.index === index);
        if (!slot)
            throw new Error(`mediasoup worker slot ${index} not found`);
        return slot;
    }
    registerRouter(slotIndex, router) {
        this.getSlot(slotIndex).routers.add(router.id);
        router.observer.once('close', () => this.getSlot(slotIndex).routers.delete(router.id));
    }
    getStats() {
        return {
            initialized: this.initialized,
            workers: this.slots.map((slot) => ({
                index: slot.index,
                pid: slot.worker.pid,
                port: slot.port,
                routers: slot.routers.size,
            })),
        };
    }
};
exports.MediasoupService = MediasoupService;
exports.MediasoupService = MediasoupService = MediasoupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MediasoupService);
//# sourceMappingURL=mediasoup.service.js.map