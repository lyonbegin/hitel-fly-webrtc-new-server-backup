import { Module } from '@nestjs/common';
import { MediasoupService } from './mediasoup.service';
import { RtcRoomService } from './rtc-room.service';
import { TransportService } from './transport.service';
import { ProducerConsumerService } from './producer-consumer.service';

@Module({
  providers: [MediasoupService, RtcRoomService, TransportService, ProducerConsumerService],
  exports: [MediasoupService, RtcRoomService, TransportService, ProducerConsumerService],
})
export class MediasoupModule {}
