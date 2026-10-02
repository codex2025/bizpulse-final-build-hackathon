import { Controller, Get, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard(@Req() req: any, @Query('month') month?: string) {
    return this.analyticsService.getDashboardMetrics(req.user.userId, month);
  }

  @Get('cashflow')
  getCashFlow(@Req() req: any) {
    return this.analyticsService.getCashFlow(req.user.userId);
  }

  @Get('expenses')
  getExpenses(@Req() req: any) {
    return this.analyticsService.getExpenseBreakdown(req.user.userId);
  }

  @Get('advanced')
  getAdvanced(@Req() req: any) {
    return this.analyticsService.getAdvancedMetrics(req.user.userId);
  }

  @Get('visualizations')
  getVisualizations(
    @Req() req: any,
    @Query('timeframe') timeframe?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getComprehensiveVisualizations(
      req.user.userId,
      {
        timeframe,
        startDate,
        endDate,
      },
    );
  }

  @Get('what-if')
  getWhatIf(@Req() req: any) {
    return this.analyticsService.calculateWhatIf(req.query);
  }

  @Get('forecast')
  getForecast(@Req() req: any) {
    return this.analyticsService.getForecast(req.user.userId);
  }

  @Get('health-history')
  getHealthHistory(@Req() req: any) {
    return this.analyticsService.getHealthScoreHistory(req.user.userId);
  }
}
