import { ParticipantPermissions } from '../realtime/interfaces/session.types';

export const TELEMEDICINE_ROLES = [
  'DOCTOR',
  'CONSULTING_DOCTOR',
  'NURSE',
  'PATIENT',
  'GUARDIAN',
  'INTERPRETER',
] as const;

export type TelemedicineRole = (typeof TELEMEDICINE_ROLES)[number];

export function permissionsForTelemedicineRole(role: TelemedicineRole): ParticipantPermissions {
  switch (role) {
    case 'DOCTOR':
      return {
        publishAudio: true,
        publishVideo: true,
        consumeAudio: true,
        consumeVideo: true,
        shareScreen: true,
        manageSession: true,
        manageParticipants: true,
      };
    case 'CONSULTING_DOCTOR':
      return {
        publishAudio: true,
        publishVideo: true,
        consumeAudio: true,
        consumeVideo: true,
        shareScreen: true,
        manageSession: false,
        manageParticipants: false,
      };
    case 'NURSE':
      return {
        publishAudio: true,
        publishVideo: true,
        consumeAudio: true,
        consumeVideo: true,
        shareScreen: false,
        manageSession: false,
        manageParticipants: false,
      };
    case 'PATIENT':
    case 'GUARDIAN':
    case 'INTERPRETER':
      return {
        publishAudio: true,
        publishVideo: true,
        consumeAudio: true,
        consumeVideo: true,
        shareScreen: false,
        manageSession: false,
        manageParticipants: false,
      };
  }
}
