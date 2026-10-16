import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
    accessGranted: boolean;
    stage2AccessGranted: boolean;
    accountEnabled: boolean;
    emailVerified: boolean;
  };
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class AccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Account status and email verification are checked by JwtStrategy.
    // Administrators bypass the Stage 2 grant requirement only.
    if (user.role === 'ADMIN') {
      return true;
    }

    if (user.stage2AccessGranted) {
      return true;
    }

    throw new ForbiddenException(
      'Access to personality assessment requires payment or administrator approval',
    );
  }
}
