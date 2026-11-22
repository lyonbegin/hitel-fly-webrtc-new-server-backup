import { TelemedicineRole } from '../telemedicine.types';
export declare class TelemedicineParticipantDto {
    userId: string;
    displayName?: string;
    role: TelemedicineRole;
}
export declare class CreateConsultationDto {
    id?: string;
    title?: string;
    scheduledAt?: string;
    participants: TelemedicineParticipantDto[];
    maxParticipants?: number;
    metadata?: Record<string, unknown>;
}
export declare class AddConsultationParticipantDto extends TelemedicineParticipantDto {
}
