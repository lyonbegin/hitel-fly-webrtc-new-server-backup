import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { MediaKind, RtpCapabilities, RtpParameters } from 'mediasoup/types';
import { RtcRoomService } from './rtc-room.service';
import { TransportService } from './transport.service';
import { ProducerDescriptor } from './rtc-room.types';

@Injectable()
export class ProducerConsumerService {
  readonly events = new EventEmitter();
  constructor(
    private readonly rooms: RtcRoomService,
    private readonly transports: TransportService,
  ) {}

  async produce(input: {
    roomId: string;
    peerId: string;
    transportId: string;
    kind: MediaKind;
    rtpParameters: RtpParameters;
    appData?: Record<string, unknown>;
  }): Promise<ProducerDescriptor> {
    const peer = this.rooms.getPeer(input.roomId, input.peerId);
    if (!peer) throw new Error('Peer not found');
    const transport = this.transports.get(input.roomId, input.peerId, input.transportId, 'send');
    const source = this.getSource(input.appData, input.kind);

    const producer = await transport.produce({
      kind: input.kind,
      rtpParameters: input.rtpParameters,
      appData: {
        ...(input.appData ?? {}),
        peerId: input.peerId,
        userId: peer.userId,
        source,
      },
    });

    peer.producers.set(producer.id, { producer, source });
    producer.observer.once('close', () => {
      peer.producers.delete(producer.id);
      this.events.emit('producerClosed', {
        roomId: input.roomId,
        peerId: input.peerId,
        userId: peer.userId,
        producerId: producer.id,
        kind: producer.kind,
        source,
      });
    });

    return {
      producerId: producer.id,
      peerId: peer.peerId,
      userId: peer.userId,
      kind: producer.kind,
      source,
      appData: producer.appData as Record<string, unknown>,
    };
  }


  getProducer(roomId: string, producerId: string) {
    const room = this.rooms.require(roomId);
    for (const peer of room.peers.values()) {
      const entry = peer.producers.get(producerId);
      if (entry) return { peer, entry };
    }
    throw new Error('Producer not found');
  }

  async consume(input: {
    roomId: string;
    peerId: string;
    transportId: string;
    producerId: string;
    rtpCapabilities: RtpCapabilities;
  }) {
    const room = this.rooms.require(input.roomId);
    const consumerPeer = room.peers.get(input.peerId);
    if (!consumerPeer) throw new Error('Consumer peer not found');
    if (!room.router.canConsume({ producerId: input.producerId, rtpCapabilities: input.rtpCapabilities })) {
      throw new Error('Client RTP capabilities cannot consume this producer');
    }

    const producerOwner = [...room.peers.values()].find((peer) => peer.producers.has(input.producerId));
    if (!producerOwner) throw new Error('Producer not found');
    if (producerOwner.peerId === input.peerId) throw new Error('Cannot consume own producer');

    const existingConsumer = [...consumerPeer.consumers.values()].find(
      (entry) => entry.consumer.producerId === input.producerId,
    );
    if (existingConsumer) throw new Error('Producer is already being consumed by this peer');

    const transport = this.transports.get(input.roomId, input.peerId, input.transportId, 'recv');
    const consumer = await transport.consume({
      producerId: input.producerId,
      rtpCapabilities: input.rtpCapabilities,
      paused: true,
      appData: {
        producerPeerId: producerOwner.peerId,
        producerUserId: producerOwner.userId,
      },
    });

    consumerPeer.consumers.set(consumer.id, {
      consumer,
      producerPeerId: producerOwner.peerId,
    });
    consumer.on('transportclose', () => consumerPeer.consumers.delete(consumer.id));
    consumer.on('producerclose', () => consumerPeer.consumers.delete(consumer.id));
    consumer.observer.once('close', () => consumerPeer.consumers.delete(consumer.id));

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      producerPeerId: producerOwner.peerId,
      producerUserId: producerOwner.userId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      appData: consumer.appData,
      producerPaused: consumer.producerPaused,
    };
  }

  async resumeConsumer(roomId: string, peerId: string, consumerId: string) {
    const consumer = this.rooms.getPeer(roomId, peerId)?.consumers.get(consumerId)?.consumer;
    if (!consumer) throw new Error('Consumer not found');
    await consumer.resume();
  }

  async pauseConsumer(roomId: string, peerId: string, consumerId: string) {
    const consumer = this.rooms.getPeer(roomId, peerId)?.consumers.get(consumerId)?.consumer;
    if (!consumer) throw new Error('Consumer not found');
    await consumer.pause();
  }

  async setPreferredLayers(roomId: string, peerId: string, consumerId: string, spatialLayer: number, temporalLayer?: number) {
    const consumer = this.rooms.getPeer(roomId, peerId)?.consumers.get(consumerId)?.consumer;
    if (!consumer) throw new Error('Consumer not found');
    if (consumer.kind !== 'video') throw new Error('Preferred layers only apply to video');
    await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
  }

  async pauseProducer(roomId: string, peerId: string, producerId: string) {
    const producer = this.rooms.getPeer(roomId, peerId)?.producers.get(producerId)?.producer;
    if (!producer) throw new Error('Producer not found');
    await producer.pause();
  }

  async resumeProducer(roomId: string, peerId: string, producerId: string) {
    const producer = this.rooms.getPeer(roomId, peerId)?.producers.get(producerId)?.producer;
    if (!producer) throw new Error('Producer not found');
    await producer.resume();
  }

  closeProducer(roomId: string, peerId: string, producerId: string) {
    const peer = this.rooms.getPeer(roomId, peerId);
    const producer = peer?.producers.get(producerId)?.producer;
    if (!peer || !producer) throw new Error('Producer not found');
    producer.close();
    peer.producers.delete(producerId);
  }

  countPublishingPeers(roomId: string, kind: MediaKind): number {
    const room = this.rooms.require(roomId);
    let count = 0;
    for (const peer of room.peers.values()) {
      if ([...peer.producers.values()].some((entry) => entry.producer.kind === kind)) count += 1;
    }
    return count;
  }

  listOtherProducers(roomId: string, peerId: string): ProducerDescriptor[] {
    const room = this.rooms.require(roomId);
    const out: ProducerDescriptor[] = [];
    for (const peer of room.peers.values()) {
      if (peer.peerId === peerId) continue;
      for (const entry of peer.producers.values()) {
        out.push({
          producerId: entry.producer.id,
          peerId: peer.peerId,
          userId: peer.userId,
          kind: entry.producer.kind,
          source: entry.source,
          appData: entry.producer.appData as Record<string, unknown>,
        });
      }
    }
    return out;
  }

  private getSource(appData: Record<string, unknown> | undefined, kind: MediaKind) {
    const raw = typeof appData?.source === 'string' ? appData.source : undefined;
    if (raw === 'camera' || raw === 'microphone' || raw === 'screen') return raw;
    return kind === 'audio' ? 'microphone' : kind === 'video' ? 'camera' : 'unknown';
  }
}
