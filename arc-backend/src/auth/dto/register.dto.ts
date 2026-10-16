import { IsEmail, IsString, MinLength } from 'class-validator';
import { Match } from '../../common/decorators/match.decorator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Match('password')
  confirmPassword!: string;
}
