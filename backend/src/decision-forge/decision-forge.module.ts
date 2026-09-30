import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecisionForgeController } from './decision-forge.controller';
import { DecisionForgeService } from './decision-forge.service';
import { DecisionRun } from './entities/decision-run.entity';
import { DecisionApproval } from './entities/approval.entity';
import { DecisionAuditLog } from './entities/audit-log.entity';
import { DecisionPolicyConfig } from './entities/policy-config.entity';
import { DecisionQueryLog } from './entities/query-log.entity';
import { DecisionWorkspaceState } from './entities/workspace-state.entity';
import { Client } from '../clients/entities/client.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DecisionRun,
      DecisionApproval,
      DecisionAuditLog,
      DecisionPolicyConfig,
      DecisionQueryLog,
      DecisionWorkspaceState,
      Client,
    ]),
  ],
  controllers: [DecisionForgeController],
  providers: [DecisionForgeService],
  exports: [DecisionForgeService],
})
export class DecisionForgeModule {}
