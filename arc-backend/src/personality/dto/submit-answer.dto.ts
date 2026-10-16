import { IsNumber } from 'class-validator';

export class SubmitAnswerDto {
  @IsNumber()
  questionId!: number;

  @IsNumber()
  rankChoiceId!: number;
}
