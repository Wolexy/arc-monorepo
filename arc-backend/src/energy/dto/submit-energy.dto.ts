import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RankingDto {
  @IsNumber()
  statementId!: number;

  @IsNumber()
  rankId!: number;
}

export class SubmitEnergyDto {
  @IsString()
  sessionId!: string;

  @IsNumber()
  energyStatementGroupId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RankingDto)
  rankings!: RankingDto[];
}
