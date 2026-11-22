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
exports.PreferredLayersDto = exports.ProducerIdDto = exports.TransportIdDto = exports.ConsumerIdDto = exports.ConsumeDto = exports.ProduceDto = exports.ConnectTransportDto = exports.CreateTransportDto = exports.RtcJoinDto = exports.SessionIdDto = exports.SessionReadyDto = exports.SessionJoinDto = void 0;
const class_validator_1 = require("class-validator");
class SessionJoinDto {
    sessionId;
}
exports.SessionJoinDto = SessionJoinDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SessionJoinDto.prototype, "sessionId", void 0);
class SessionReadyDto {
    sessionId;
    ready;
}
exports.SessionReadyDto = SessionReadyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SessionReadyDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SessionReadyDto.prototype, "ready", void 0);
class SessionIdDto {
    sessionId;
}
exports.SessionIdDto = SessionIdDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SessionIdDto.prototype, "sessionId", void 0);
class RtcJoinDto {
    sessionId;
    resume;
}
exports.RtcJoinDto = RtcJoinDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RtcJoinDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RtcJoinDto.prototype, "resume", void 0);
class CreateTransportDto {
    sessionId;
    direction;
}
exports.CreateTransportDto = CreateTransportDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTransportDto.prototype, "direction", void 0);
class ConnectTransportDto {
    sessionId;
    transportId;
    dtlsParameters;
}
exports.ConnectTransportDto = ConnectTransportDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectTransportDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectTransportDto.prototype, "transportId", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ConnectTransportDto.prototype, "dtlsParameters", void 0);
class ProduceDto {
    sessionId;
    transportId;
    kind;
    rtpParameters;
    appData;
}
exports.ProduceDto = ProduceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProduceDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProduceDto.prototype, "transportId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProduceDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ProduceDto.prototype, "rtpParameters", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ProduceDto.prototype, "appData", void 0);
class ConsumeDto {
    sessionId;
    transportId;
    producerId;
    rtpCapabilities;
}
exports.ConsumeDto = ConsumeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConsumeDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConsumeDto.prototype, "transportId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConsumeDto.prototype, "producerId", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ConsumeDto.prototype, "rtpCapabilities", void 0);
class ConsumerIdDto {
    sessionId;
    consumerId;
}
exports.ConsumerIdDto = ConsumerIdDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConsumerIdDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConsumerIdDto.prototype, "consumerId", void 0);
class TransportIdDto {
    sessionId;
    transportId;
}
exports.TransportIdDto = TransportIdDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransportIdDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransportIdDto.prototype, "transportId", void 0);
class ProducerIdDto {
    sessionId;
    producerId;
}
exports.ProducerIdDto = ProducerIdDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProducerIdDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProducerIdDto.prototype, "producerId", void 0);
class PreferredLayersDto extends ConsumerIdDto {
    spatialLayer;
    temporalLayer;
}
exports.PreferredLayersDto = PreferredLayersDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PreferredLayersDto.prototype, "spatialLayer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PreferredLayersDto.prototype, "temporalLayer", void 0);
//# sourceMappingURL=realtime.dto.js.map