import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';
import * as os from 'os';
import { lookup } from 'node:dns/promises';
import type { Router, WebRtcServer, Worker, WorkerLogLevel } from 'mediasoup/types';

export interface WorkerSlot {
  index: number;
  worker: Worker;
  webRtcServer: WebRtcServer;
  port: number;
  routers: Set<string>;
}

@Injectable()
export class MediasoupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediasoupService.name);
  private readonly slots: WorkerSlot[] = [];
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.initialize();
  }

  async onModuleDestroy() {
    for (const slot of this.slots) {
      try { slot.webRtcServer.close(); } catch {}
      try { slot.worker.close(); } catch {}
    }
    this.slots.length = 0;
    this.initialized = false;
  }

  private async initialize() {
    const cpuCount = Math.max(1, os.cpus().length);
    const configured = Number(this.config.get<string>('MEDIASOUP_WORKERS') ?? cpuCount);
    const maxWorkers = Number(this.config.get<string>('MEDIASOUP_MAX_WORKERS') ?? 4);
    const workerCount = Math.max(1, Math.min(configured, cpuCount, maxWorkers));
    const tcpListenIp = this.config.get<string>('MEDIASOUP_LISTEN_IP') ?? '0.0.0.0';
    const announcedAddress = this.config.get<string>('MEDIASOUP_ANNOUNCED_ADDRESS') ?? '127.0.0.1';
    const portBase = Number(this.config.get<string>('MEDIASOUP_WEBRTC_PORT_BASE') ?? 40000);
    const logLevel = (this.config.get<string>('MEDIASOUP_LOG_LEVEL') ?? 'warn') as WorkerLogLevel;
    const udpListenIp = await this.resolveUdpListenIp(tcpListenIp);
    this.logger.log(`mediasoup network: UDP=${udpListenIp}, TCP=${tcpListenIp}, announced=${announcedAddress}`);

    for (let index = 0; index < workerCount; index += 1) {
      const worker = await mediasoup.createWorker({
        logLevel,
        logTags: ['ice', 'dtls', 'rtp', 'rtcp', 'srtp'],
      });

      worker.on('died', (error) => {
        this.logger.error(`mediasoup worker ${index} died`, error?.stack ?? String(error));
        // A mediasoup worker dying is considered fatal; process manager should restart this node.
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

  private async resolveUdpListenIp(localFallback: string) {
    if (!process.env.FLY_APP_NAME) return localFallback;
    try {
      const result = await lookup('fly-global-services', { family: 4 });
      this.logger.log(`Fly UDP bind address resolved: ${result.address}`);
      return result.address;
    } catch (error) {
      this.logger.error('Failed to resolve fly-global-services. UDP WebRTC cannot start safely on Fly.', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  getLeastLoadedSlot(): WorkerSlot {
    if (!this.initialized || this.slots.length === 0) throw new Error('mediasoup is not initialized');
    return [...this.slots].sort((a, b) => a.routers.size - b.routers.size)[0];
  }

  getSlot(index: number): WorkerSlot {
    const slot = this.slots.find((item) => item.index === index);
    if (!slot) throw new Error(`mediasoup worker slot ${index} not found`);
    return slot;
  }

  registerRouter(slotIndex: number, router: Router) {
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
}
