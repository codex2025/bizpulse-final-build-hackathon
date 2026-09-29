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

import { SeedService } from './common/services/seed.service';
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
      // On Vercel only /tmp is writable, and it's wiped between cold starts --
      // that's fine here: `synchronize: true` recreates the schema and
      // SeedService (below) reseeds the demo account on every fresh instance.
      database: process.env.VERCEL ? '/tmp/finsight.db' : join(process.cwd(), 'finsight.db'),
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
  providers: [AppService, SeedService],
})
export class AppModule {}

