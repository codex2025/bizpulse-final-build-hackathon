import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractAnalysis } from './entities/contract-analysis.entity';
import { ContractClause } from './entities/contract-clause.entity';
import { ContractQuery } from './entities/contract-query.entity';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractAnalysis, ContractClause, ContractQuery]),
    AnalyticsModule,
  ],
  providers: [ContractsService],
  controllers: [ContractsController],
  exports: [ContractsService],
})
export class ContractsModule {}


