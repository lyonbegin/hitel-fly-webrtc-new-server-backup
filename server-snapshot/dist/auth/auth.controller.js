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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const class_validator_1 = require("class-validator");
const auth_service_1 = require("./auth.service");
class DevTokenDto {
    userId;
    name;
    platformRole;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DevTokenDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DevTokenDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['admin', 'staff', 'doctor', 'user']),
    __metadata("design:type", String)
], DevTokenDto.prototype, "platformRole", void 0);
let AuthController = class AuthController {
    auth;
    config;
    constructor(auth, config) {
        this.auth = auth;
        this.config = config;
    }
    async devToken(body, testLoginKey) {
        const production = (this.config.get('NODE_ENV') ?? 'development') === 'production';
        if (!production) {
            return { accessToken: await this.auth.issueDevToken(body) };
        }
        const enabled = (this.config.get('TEST_LOGIN_ENABLED') ?? 'false').toLowerCase() === 'true';
        if (!enabled) {
            throw new common_1.ForbiddenException('Test login is disabled');
        }
        const expectedKey = this.config.get('TEST_LOGIN_KEY');
        if (!expectedKey) {
            throw new common_1.ForbiddenException('Test login is not configured');
        }
        if (!testLoginKey || testLoginKey !== expectedKey) {
            throw new common_1.UnauthorizedException('Invalid test login key');
        }
        return { accessToken: await this.auth.issueDevToken(body) };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('dev-token'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-test-login-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [DevTokenDto, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "devToken", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map