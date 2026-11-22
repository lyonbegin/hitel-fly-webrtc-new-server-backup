import { Controller, Get } from '@nestjs/common';
import { MediasoupService } from '../mediasoup/mediasoup.service';
import { SessionService } from '../realtime/session.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly mediasoup: MediasoupService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  getHealth() {
    return {
      ok: true,
      uptimeSec: Math.floor(process.uptime()),
      mediasoup: this.mediasoup.getStats(),
      sessions: this.sessions.getStats(),
      timestamp: new Date().toISOString(),
    };
  }
}
