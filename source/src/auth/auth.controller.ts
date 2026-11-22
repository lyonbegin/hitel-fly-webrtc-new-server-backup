import { Body, Controller, ForbiddenException, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { PlatformRole } from '../common/types';

class DevTokenDto {
  @IsString() userId: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['admin', 'staff', 'doctor', 'user']) platformRole?: PlatformRole;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('dev-token')
  async devToken(@Body() body: DevTokenDto, @Headers('x-test-login-key') testLoginKey?: string) {
    const production = (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
    if (!production) {
      return { accessToken: await this.auth.issueDevToken(body) };
    }
    const enabled = (this.config.get<string>('TEST_LOGIN_ENABLED') ?? 'false').toLowerCase() === 'true';
    if (!enabled) {
      throw new ForbiddenException('Test login is disabled');
    }
    const expectedKey = this.config.get<string>('TEST_LOGIN_KEY');
    if (!expectedKey) {
      throw new ForbiddenException('Test login is not configured');
    }
    if (!testLoginKey || testLoginKey !== expectedKey) {
      throw new UnauthorizedException('Invalid test login key');
    }
    return { accessToken: await this.auth.issueDevToken(body) };
  }
}
