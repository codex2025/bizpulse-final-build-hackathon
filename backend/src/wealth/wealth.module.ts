import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WealthItem } from './entities/wealth-item.entity';
import { WealthService } from './wealth.service';
import { WealthController } from './wealth.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WealthItem])],
  providers: [WealthService],
  controllers: [WealthController],
  exports: [WealthService],
})
export class WealthModule {}
