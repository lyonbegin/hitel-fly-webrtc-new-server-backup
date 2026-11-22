import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { HttpJwtGuard } from './http-jwt.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-only-change-me',
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '12h') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, HttpJwtGuard],
  exports: [AuthService, HttpJwtGuard, JwtModule],
})
export class AuthModule {}
