import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediasoupModule } from '../mediasoup/mediasoup.module';
import { SessionService } from './session.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, MediasoupModule],
  providers: [SessionService, RealtimeGateway],
  exports: [SessionService],
})
export class RealtimeModule {}
