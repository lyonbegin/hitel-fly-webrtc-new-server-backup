import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MediasoupModule } from '../mediasoup/mediasoup.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({ imports: [MediasoupModule, RealtimeModule], controllers: [HealthController] })
export class HealthModule {}
