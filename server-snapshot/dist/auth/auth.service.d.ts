import { JwtService } from '@nestjs/jwt';
import { AuthClaims, PlatformRole } from '../common/types';
export declare class AuthService {
    private readonly jwt;
    constructor(jwt: JwtService);
    verify(token?: string): Promise<AuthClaims>;
    issueDevToken(input: {
        userId: string;
        name?: string;
        platformRole?: PlatformRole;
    }): Promise<string>;
    extractBearer(value?: string): string | undefined;
}
