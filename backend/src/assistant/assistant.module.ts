import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { GoalsModule } from '../goals/goals.module';
import { WealthModule } from '../wealth/wealth.module';
import { ContractsModule } from '../contracts/contracts.module';
import { DecisionForgeModule } from '../decision-forge/decision-forge.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Expense]),
    AnalyticsModule,
    GoalsModule,
    WealthModule,
    ContractsModule,
    DecisionForgeModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
