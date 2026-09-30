import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ClientsModule } from './clients/clients.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ContractsModule } from './contracts/contracts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GoalsModule } from './goals/goals.module';
import { WealthModule } from './wealth/wealth.module';
import { StatementModule } from './statement/statement.module';
import { DecisionForgeModule } from './decision-forge/decision-forge.module';
import { join } from 'path';

import { User } from './users/entities/user.entity';
import { Client } from './clients/entities/client.entity';
import { Invoice } from './invoices/entities/invoice.entity';
import { InvoiceItem } from './invoices/entities/invoice-item.entity';
import { Expense } from './expenses/entities/expense.entity';
import { Goal } from './goals/entities/goal.entity';
import { WealthItem } from './wealth/entities/wealth-item.entity';
import { HealthScoreSnapshot } from './analytics/entities/health-score-snapshot.entity';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      // DATABASE_PATH puts the SQLite file on a persistent volume (for example a mounted disk); without
      // it, Vercel only has /tmp, which is wiped between cold starts, and `synchronize: true` recreates an EMPTY
      // schema. Nothing is seeded: there are no built-in accounts, every user signs up (Google or email).
      // Accounts, runs, approvals, policy and each user's recoverable workspace state live in this one file.
      database: process.env.DATABASE_PATH || (process.env.VERCEL ? '/tmp/finsight.db' : join(process.cwd(), 'finsight.db')),
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User, Client, Invoice, InvoiceItem, Expense, Goal, WealthItem, HealthScoreSnapshot]),
    AuthModule,
    UsersModule,
    InvoicesModule,
    ClientsModule,
    ExpensesModule,
    ContractsModule,
    AnalyticsModule,
    GoalsModule,
    WealthModule,
    StatementModule,
    DecisionForgeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

