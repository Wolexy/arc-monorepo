import { DominantTypeReportDto } from './dominant-type-report.dto';
import { RunnerUpTypeReportDto } from './runner-up-type-report.dto';
import { ConfidenceDto } from './confidence.dto';

export class FinalReportDto {
  sessionId!: string;
  dominantTypes!: DominantTypeReportDto[];
  runnerUp!: RunnerUpTypeReportDto | null;
  confidence!: ConfidenceDto;
}
