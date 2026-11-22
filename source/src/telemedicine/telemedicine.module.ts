import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TelemedicineController } from './telemedicine.controller';
import { TelemedicineService } from './telemedicine.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [TelemedicineController],
  providers: [TelemedicineService],
})
export class TelemedicineModule {}
