import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PlatformRole } from '../common/types';
declare class DevTokenDto {
    userId: string;
    name?: string;
    platformRole?: PlatformRole;
}
export declare class AuthController {
    private readonly auth;
    private readonly config;
    constructor(auth: AuthService, config: ConfigService);
    devToken(body: DevTokenDto, testLoginKey?: string): Promise<{
        accessToken: string;
    }>;
}
export {};
