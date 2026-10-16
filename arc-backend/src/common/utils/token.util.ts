import { randomBytes } from 'crypto';

export class TokenUtil {
  static generate(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  static expiresInHours(hours: number): Date {
    const expires = new Date();
    expires.setHours(expires.getHours() + hours);
    return expires;
  }
}
