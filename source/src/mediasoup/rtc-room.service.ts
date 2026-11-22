import { Injectable, Logger } from '@nestjs/common';
import type { RtpCapabilities } from 'mediasoup/types';
import { MediasoupService } from './mediasoup.service';
import { mediaCodecs } from './media.config';
import { RtcPeer, RtcRoom } from './rtc-room.types';

@Injectable()
export class RtcRoomService {
  private readonly logger = new Logger(RtcRoomService.name);
  private readonly rooms = new Map<string, RtcRoom>();

  constructor(private readonly mediasoup: MediasoupService) {}

  async create(roomId: string): Promise<RtcRoom> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    const slot = this.mediasoup.getLeastLoadedSlot();
    const router = await slot.worker.createRouter({ mediaCodecs, appData: { roomId } });
    this.mediasoup.registerRouter(slot.index, router);

    const room: RtcRoom = {
      id: roomId,
      workerIndex: slot.index,
      router,
      peers: new Map(),
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    router.observer.once('close', () => this.rooms.delete(roomId));
    this.logger.log(`RTC room ${roomId} created on worker ${slot.index}`);
    return room;
  }

  get(roomId: string) {
    return this.rooms.get(roomId);
  }

  require(roomId: string): RtcRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`RTC room ${roomId} not found`);
    return room;
  }

  getRtpCapabilities(roomId: string): RtpCapabilities {
    return this.require(roomId).router.rtpCapabilities;
  }

  upsertPeer(roomId: string, input: Omit<RtcPeer, 'transports' | 'producers' | 'consumers' | 'joinedAt'>): RtcPeer {
    const room = this.require(roomId);
    const existing = room.peers.get(input.peerId);
    if (existing) {
      existing.socketId = input.socketId;
      existing.connected = input.connected;
      existing.displayName = input.displayName;
      existing.role = input.role;
      return existing;
    }

    const peer: RtcPeer = {
      ...input,
      joinedAt: Date.now(),
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    room.peers.set(peer.peerId, peer);
    return peer;
  }

  getPeer(roomId: string, peerId: string) {
    return this.rooms.get(roomId)?.peers.get(peerId);
  }

  markPeerDisconnected(roomId: string, peerId: string) {
    const peer = this.getPeer(roomId, peerId);
    if (peer) {
      peer.connected = false;
      peer.socketId = undefined;
    }
  }

  closePeer(roomId: string, peerId: string) {
    const room = this.rooms.get(roomId);
    const peer = room?.peers.get(peerId);
    if (!room || !peer) return;

    for (const entry of peer.consumers.values()) {
      try { entry.consumer.close(); } catch {}
    }
    for (const entry of peer.producers.values()) {
      try { entry.producer.close(); } catch {}
    }
    for (const entry of peer.transports.values()) {
      try { entry.transport.close(); } catch {}
    }
    peer.consumers.clear();
    peer.producers.clear();
    peer.transports.clear();
    room.peers.delete(peerId);
  }

  closeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const peerId of [...room.peers.keys()]) this.closePeer(roomId, peerId);
    try { room.router.close(); } catch {}
    this.rooms.delete(roomId);
    this.logger.log(`RTC room ${roomId} closed`);
  }

  listRooms() {
    return [...this.rooms.values()];
  }
}
