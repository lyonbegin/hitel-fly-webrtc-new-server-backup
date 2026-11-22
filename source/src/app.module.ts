import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MediasoupModule } from './mediasoup/mediasoup.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TelemedicineModule } from './telemedicine/telemedicine.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    AuthModule,
    HealthModule,
    MediasoupModule,
    RealtimeModule,
    TelemedicineModule,
  ],
})
export class AppModule {}
