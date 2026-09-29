import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.goalsService.create(req.user.userId, body);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.goalsService.findAll(req.user.userId);
  }

  @Get('summary')
  getSummary(@Req() req: any) {
    return this.goalsService.getSummary(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.goalsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.goalsService.update(id, req.user.userId, body);
  }

  @Post(':id/contribute')
  contribute(@Param('id') id: string, @Body() body: { amount: number }, @Req() req: any) {
    return this.goalsService.contribute(id, req.user.userId, body.amount);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.goalsService.remove(id, req.user.userId);
  }
}
