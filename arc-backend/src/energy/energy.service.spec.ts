import { Test, TestingModule } from '@nestjs/testing';
import { EnergyService } from './energy.service';

describe('EnergyService', () => {
  let service: EnergyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnergyService],
    }).compile();

    service = module.get<EnergyService>(EnergyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
