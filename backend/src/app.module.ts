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
import { AssistantModule } from './assistant/assistant.module';
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
    // DATABASE_URL (a Postgres connection string) selects a shared database. Serverless hosts run several
    // copies of this gateway at once; with SQLite each copy has its own file, so an account or dataset saved
    // on one copy is missing on the next request. Without DATABASE_URL the local SQLite file below is used.
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            type: 'postgres',
            url: process.env.DATABASE_URL,
            ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
              ? false
              : { rejectUnauthorized: false },
            extra: { max: 3 }, // few connections per copy: many copies share one database
            autoLoadEntities: true,
            synchronize: true,
          }
        : {
            type: 'better-sqlite3',
            // DATABASE_PATH puts the SQLite file on a persistent volume (for example a mounted disk); without
            // it, Vercel only has /tmp, which is wiped between cold starts, and `synchronize: true` recreates an EMPTY
            // schema. Nothing is seeded: there are no built-in accounts, every user signs up (Google or email).
            // Accounts, runs, approvals, policy and each user's recoverable workspace state live in this one file.
            database:
              process.env.DATABASE_PATH ||
              (process.env.VERCEL
                ? '/tmp/finsight.db'
                : join(process.cwd(), 'finsight.db')),
            autoLoadEntities: true,
            synchronize: true,
          },
    ),
    TypeOrmModule.forFeature([
      User,
      Client,
      Invoice,
      InvoiceItem,
      Expense,
      Goal,
      WealthItem,
      HealthScoreSnapshot,
    ]),
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
    AssistantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
