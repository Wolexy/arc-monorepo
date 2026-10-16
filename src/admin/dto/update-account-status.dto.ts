import { IsBoolean } from 'class-validator';

export class UpdateAccountStatusDto {
  // Must be a real JSON boolean; strings like "false" are rejected.
  @IsBoolean()
  accountEnabled!: boolean;
}
