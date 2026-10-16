import { Request } from 'express';

export interface AuthRequest extends Request {
  user: {
    userId: number;
    email: string;
    role: string;
    accessGranted: boolean;
    stage2AccessGranted: boolean;
    accountEnabled: boolean;
    emailVerified: boolean;
  };
}
