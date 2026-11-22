import { ParticipantPermissions } from '../realtime/interfaces/session.types';
export declare const TELEMEDICINE_ROLES: readonly ["DOCTOR", "CONSULTING_DOCTOR", "NURSE", "PATIENT", "GUARDIAN", "INTERPRETER"];
export type TelemedicineRole = (typeof TELEMEDICINE_ROLES)[number];
export declare function permissionsForTelemedicineRole(role: TelemedicineRole): ParticipantPermissions;
