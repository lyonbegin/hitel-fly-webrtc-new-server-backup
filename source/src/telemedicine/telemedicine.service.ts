import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { SessionService } from '../realtime/session.service';
import { AuthClaims } from '../common/types';
import { CreateConsultationDto, AddConsultationParticipantDto } from './dto/telemedicine.dto';
import { permissionsForTelemedicineRole } from './telemedicine.types';

@Injectable()
export class TelemedicineService {
  constructor(private readonly sessions: SessionService) {}

  create(dto: CreateConsultationDto, actor: AuthClaims) {
    if (!['admin', 'staff', 'doctor'].includes(actor.platformRole ?? 'user')) {
      throw new ForbiddenException('Only clinical staff can create consultations');
    }

    const doctors = dto.participants.filter((p) => p.role === 'DOCTOR');
    const patients = dto.participants.filter((p) => p.role === 'PATIENT');
    if (doctors.length < 1) throw new BadRequestException('At least one primary doctor is required');
    if (patients.length < 1) throw new BadRequestException('At least one patient is required');
    if (actor.platformRole === 'doctor' && !doctors.some((p) => p.userId === actor.sub)) {
      throw new ForbiddenException('Doctor creating a consultation must be a primary doctor in it');
    }

    const session = this.sessions.create({
      id: dto.id,
      type: 'TELEMEDICINE',
      title: dto.title ?? 'Remote consultation',
      scheduledAt: dto.scheduledAt,
      hostUserIds: doctors.map((p) => p.userId),
      participants: dto.participants.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        role: p.role,
        permissions: permissionsForTelemedicineRole(p.role),
      })),
      policy: {
        topology: 'MANY_TO_MANY',
        maxParticipants: dto.maxParticipants ?? Math.max(8, dto.participants.length),
        maxVideoPublishers: dto.maxParticipants ?? Math.max(8, dto.participants.length),
        maxAudioPublishers: dto.maxParticipants ?? Math.max(8, dto.participants.length),
        waitingRoom: true,
        requireHostStart: true,
        allowUnlistedParticipants: false,
        allowRejoinAfterEnd: false,
      },
      metadata: dto.metadata,
    });

    return this.sessions.toPublic(session);
  }

  get(sessionId: string, actorUserId: string) {
    this.sessions.requireParticipant(sessionId, actorUserId);
    return this.sessions.toPublic(this.sessions.require(sessionId));
  }

  listForUser(userId: string) {
    return this.sessions.listForUser(userId).map((session) => this.sessions.toPublic(session));
  }

  async start(sessionId: string, actorUserId: string) {
    return this.sessions.toPublic(await this.sessions.start(sessionId, actorUserId));
  }

  end(sessionId: string, actorUserId: string) {
    return this.sessions.toPublic(this.sessions.end(sessionId, actorUserId));
  }

  addParticipant(sessionId: string, dto: AddConsultationParticipantDto, actorUserId: string) {
    return this.sessions.addParticipant(
      sessionId,
      {
        userId: dto.userId,
        displayName: dto.displayName,
        role: dto.role,
        permissions: permissionsForTelemedicineRole(dto.role),
      },
      actorUserId,
    );
  }

  removeParticipant(sessionId: string, userId: string, actorUserId: string) {
    this.sessions.removeParticipant(sessionId, userId, actorUserId);
    return { success: true };
  }
}
