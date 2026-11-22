import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DtlsParameters } from 'mediasoup/types';
import { MediasoupService } from './mediasoup.service';
import { RtcRoomService } from './rtc-room.service';
import { TransportDirection } from './rtc-room.types';

@Injectable()
export class TransportService {
  constructor(
    private readonly config: ConfigService,
    private readonly mediasoup: MediasoupService,
    private readonly rooms: RtcRoomService,
  ) {}

  async create(roomId: string, peerId: string, direction: TransportDirection) {
    const room = this.rooms.require(roomId);
    const peer = room.peers.get(peerId);
    if (!peer) throw new Error('Peer not joined to RTC room');

    const existing = [...peer.transports.values()].find((entry) => entry.direction === direction);
    if (existing) throw new Error(`${direction} transport already exists for this peer`);

    const slot = this.mediasoup.getSlot(room.workerIndex);
    const transport = await room.router.createWebRtcTransport({
      webRtcServer: slot.webRtcServer,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: Number(
        this.config.get<string>('MEDIASOUP_INITIAL_BITRATE') ?? 1_500_000,
      ),
      appData: { roomId, peerId, direction },
    });

    const maxIncoming = Number(
      this.config.get<string>('MEDIASOUP_MAX_INCOMING_BITRATE') ?? 3_000_000,
    );
    if (maxIncoming > 0) await transport.setMaxIncomingBitrate(maxIncoming);

    peer.transports.set(transport.id, { direction, transport });
    transport.observer.once('close', () => peer.transports.delete(transport.id));

    return this.toClientOptions(transport);
  }

  async connect(roomId: string, peerId: string, transportId: string, dtlsParameters: DtlsParameters) {
    const peer = this.rooms.getPeer(roomId, peerId);
    const entry = peer?.transports.get(transportId);
    if (!entry) throw new Error('Transport not found');
    await entry.transport.connect({ dtlsParameters });
  }

  close(roomId: string, peerId: string, transportId: string) {
    const peer = this.rooms.getPeer(roomId, peerId);
    const entry = peer?.transports.get(transportId);
    if (!peer || !entry) throw new Error('Transport not found');
    entry.transport.close();
    peer.transports.delete(transportId);
  }

  async restartIce(roomId: string, peerId: string, transportId: string) {
    const transport = this.get(roomId, peerId, transportId);
    return transport.restartIce();
  }

  get(roomId: string, peerId: string, transportId: string, expected?: TransportDirection) {
    const entry = this.rooms.getPeer(roomId, peerId)?.transports.get(transportId);
    if (!entry) throw new Error('Transport not found');
    if (expected && entry.direction !== expected) throw new Error(`Expected ${expected} transport`);
    return entry.transport;
  }

  private toClientOptions(transport: any) {
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }
}
