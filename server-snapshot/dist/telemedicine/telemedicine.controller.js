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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemedicineController = void 0;
const common_1 = require("@nestjs/common");
const http_jwt_guard_1 = require("../auth/http-jwt.guard");
const telemedicine_service_1 = require("./telemedicine.service");
const telemedicine_dto_1 = require("./dto/telemedicine.dto");
let TelemedicineController = class TelemedicineController {
    telemedicine;
    constructor(telemedicine) {
        this.telemedicine = telemedicine;
    }
    create(dto, req) {
        return this.telemedicine.create(dto, req.auth);
    }
    listMine(req) {
        return this.telemedicine.listForUser(req.auth.sub);
    }
    get(id, req) {
        return this.telemedicine.get(id, req.auth.sub);
    }
    start(id, req) {
        return this.telemedicine.start(id, req.auth.sub);
    }
    end(id, req) {
        return this.telemedicine.end(id, req.auth.sub);
    }
    addParticipant(id, dto, req) {
        return this.telemedicine.addParticipant(id, dto, req.auth.sub);
    }
    removeParticipant(id, userId, req) {
        return this.telemedicine.removeParticipant(id, userId, req.auth.sub);
    }
};
exports.TelemedicineController = TelemedicineController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [telemedicine_dto_1.CreateConsultationDto, Object]),
    __metadata("design:returntype", void 0)
], TelemedicineController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TelemedicineController.prototype, "listMine", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TelemedicineController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TelemedicineController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(':id/end'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TelemedicineController.prototype, "end", null);
__decorate([
    (0, common_1.Post)(':id/participants'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, telemedicine_dto_1.AddConsultationParticipantDto, Object]),
    __metadata("design:returntype", void 0)
], TelemedicineController.prototype, "addParticipant", null);
__decorate([
    (0, common_1.Delete)(':id/participants/:userId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], TelemedicineController.prototype, "removeParticipant", null);
exports.TelemedicineController = TelemedicineController = __decorate([
    (0, common_1.UseGuards)(http_jwt_guard_1.HttpJwtGuard),
    (0, common_1.Controller)('telemedicine/consultations'),
    __metadata("design:paramtypes", [telemedicine_service_1.TelemedicineService])
], TelemedicineController);
//# sourceMappingURL=telemedicine.controller.js.map