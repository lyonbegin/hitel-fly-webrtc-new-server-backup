import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class HttpJwtGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.auth.extractBearer(request.headers?.authorization);
    request.auth = await this.auth.verify(token);
    return true;
  }
}
