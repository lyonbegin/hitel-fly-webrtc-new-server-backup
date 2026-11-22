"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TELEMEDICINE_ROLES = void 0;
exports.permissionsForTelemedicineRole = permissionsForTelemedicineRole;
exports.TELEMEDICINE_ROLES = [
    'DOCTOR',
    'CONSULTING_DOCTOR',
    'NURSE',
    'PATIENT',
    'GUARDIAN',
    'INTERPRETER',
];
function permissionsForTelemedicineRole(role) {
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
//# sourceMappingURL=telemedicine.types.js.map