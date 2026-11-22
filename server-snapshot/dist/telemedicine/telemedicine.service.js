"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemedicineService = void 0;
const common_1 = require("@nestjs/common");
const session_service_1 = require("../realtime/session.service");
const telemedicine_types_1 = require("./telemedicine.types");
let TelemedicineService = class TelemedicineService {
    sessions;
    constructor(sessions) {
        this.sessions = sessions;
    }
    create(dto, actor) {
        if (!['admin', 'staff', 'doctor'].includes(actor.platformRole ?? 'user')) {
            throw new common_1.ForbiddenException('Only clinical staff can create consultations');
        }
        const doctors = dto.participants.filter((p) => p.role === 'DOCTOR');
        const patients = dto.participants.filter((p) => p.role === 'PATIENT');
        if (doctors.length < 1)
            throw new common_1.BadRequestException('At least one primary doctor is required');
        if (patients.length < 1)
            throw new common_1.BadRequestException('At least one patient is required');
        if (actor.platformRole === 'doctor' && !doctors.some((p) => p.userId === actor.sub)) {
            throw new common_1.ForbiddenException('Doctor creating a consultation must be a primary doctor in it');
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
                permissions: (0, telemedicine_types_1.permissionsForTelemedicineRole)(p.role),
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
    get(sessionId, actorUserId) {
        this.sessions.requireParticipant(sessionId, actorUserId);
        return this.sessions.toPublic(this.sessions.require(sessionId));
    }
    listForUser(userId) {
        return this.sessions.listForUser(userId).map((session) => this.sessions.toPublic(session));
    }
    async start(sessionId, actorUserId) {
        return this.sessions.toPublic(await this.sessions.start(sessionId, actorUserId));
    }
    end(sessionId, actorUserId) {
        return this.sessions.toPublic(this.sessions.end(sessionId, actorUserId));
    }
    addParticipant(sessionId, dto, actorUserId) {
        return this.sessions.addParticipant(sessionId, {
            userId: dto.userId,
            displayName: dto.displayName,
            role: dto.role,
            permissions: (0, telemedicine_types_1.permissionsForTelemedicineRole)(dto.role),
        }, actorUserId);
    }
    removeParticipant(sessionId, userId, actorUserId) {
        this.sessions.removeParticipant(sessionId, userId, actorUserId);
        return { success: true };
    }
};
exports.TelemedicineService = TelemedicineService;
exports.TelemedicineService = TelemedicineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService])
], TelemedicineService);
//# sourceMappingURL=telemedicine.service.js.map