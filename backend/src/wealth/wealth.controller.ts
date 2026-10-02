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
import { WealthService } from './wealth.service';

@Controller('wealth')
@UseGuards(JwtAuthGuard)
export class WealthController {
  constructor(private readonly wealthService: WealthService) {}

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.wealthService.create(req.user.userId, body);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.wealthService.findAll(req.user.userId);
  }

  @Get('summary')
  getSummary(@Req() req: any) {
    return this.wealthService.getNetWorthSummary(req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.wealthService.update(id, req.user.userId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.wealthService.remove(id, req.user.userId);
  }
}
