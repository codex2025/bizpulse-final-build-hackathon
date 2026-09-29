import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { StatementController } from './statement.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({ storage: undefined }), // memory storage
  ],
  controllers: [StatementController],
})
export class StatementModule {}
