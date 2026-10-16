export class DominantTypeReportDto {
  readonly personalityTypeId!: number;
  readonly code?: string;
  readonly name?: string;
  readonly title?: string;
  readonly score!: number;
  readonly overview!: string;
  readonly strengths!: string;
  readonly weaknesses!: string;
  readonly growthPath!: string;
}
