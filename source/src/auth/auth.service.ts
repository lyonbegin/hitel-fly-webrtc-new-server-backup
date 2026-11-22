import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthClaims, PlatformRole } from '../common/types';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async verify(token?: string): Promise<AuthClaims> {
    if (!token) throw new UnauthorizedException('Missing access token');
    try {
      return await this.jwt.verifyAsync<AuthClaims>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async issueDevToken(input: { userId: string; name?: string; platformRole?: PlatformRole }) {
    const claims: AuthClaims = {
      sub: input.userId,
      name: input.name,
      platformRole: input.platformRole ?? 'user',
    };
    return this.jwt.signAsync(claims);
  }

  extractBearer(value?: string): string | undefined {
    if (!value) return undefined;
    const match = /^Bearer\s+(.+)$/i.exec(value.trim());
    return match?.[1];
  }
}
