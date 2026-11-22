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
exports.AddConsultationParticipantDto = exports.CreateConsultationDto = exports.TelemedicineParticipantDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const telemedicine_types_1 = require("../telemedicine.types");
class TelemedicineParticipantDto {
    userId;
    displayName;
    role;
}
exports.TelemedicineParticipantDto = TelemedicineParticipantDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TelemedicineParticipantDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TelemedicineParticipantDto.prototype, "displayName", void 0);
__decorate([
    (0, class_validator_1.IsIn)(telemedicine_types_1.TELEMEDICINE_ROLES),
    __metadata("design:type", String)
], TelemedicineParticipantDto.prototype, "role", void 0);
class CreateConsultationDto {
    id;
    title;
    scheduledAt;
    participants;
    maxParticipants;
    metadata;
}
exports.CreateConsultationDto = CreateConsultationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateConsultationDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateConsultationDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateConsultationDto.prototype, "scheduledAt", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ArrayMaxSize)(32),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TelemedicineParticipantDto),
    __metadata("design:type", Array)
], CreateConsultationDto.prototype, "participants", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2),
    (0, class_validator_1.Max)(32),
    __metadata("design:type", Number)
], CreateConsultationDto.prototype, "maxParticipants", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateConsultationDto.prototype, "metadata", void 0);
class AddConsultationParticipantDto extends TelemedicineParticipantDto {
}
exports.AddConsultationParticipantDto = AddConsultationParticipantDto;
//# sourceMappingURL=telemedicine.dto.js.map