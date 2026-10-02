import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.expensesService.create(req.user.userId, body);
  }

  @Post('bulk')
  bulkCreate(@Body() body: { transactions: any[] }, @Req() req: any) {
    return this.expensesService.bulkCreate(req.user.userId, body.transactions);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.expensesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.expensesService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.expensesService.update(id, req.user.userId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.expensesService.remove(id, req.user.userId);
  }
}
