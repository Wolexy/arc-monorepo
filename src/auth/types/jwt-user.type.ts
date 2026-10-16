export interface JwtUser {
  sub: number;
  email: string;
  role: string;
  accessGranted: boolean;
  stage2AccessGranted: boolean;
  accountEnabled: boolean;
  emailVerified: boolean;
}