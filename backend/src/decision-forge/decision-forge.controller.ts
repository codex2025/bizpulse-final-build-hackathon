import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DecisionForgeService } from './decision-forge.service';

@Controller('decision-forge')
@UseGuards(JwtAuthGuard)
export class DecisionForgeController {
  constructor(private readonly dfService: DecisionForgeService) {}

  @Get('dataset')
  getDataset() {
    return this.dfService.getDataset();
  }

  @Post('reset-demo')
  resetDemo(@Req() req: any) {
    return this.dfService.resetDemoData(req.user.userId, req.user.email);
  }

  @Post('ingest/file')
  @UseInterceptors(FileInterceptor('file'))
  ingestFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.dfService.ingestFile(file, req.user.userId, req.user.email);
  }

  @Post('ingest/apply-mapping')
  applyMapping(@Body() body: { records: any[] }, @Req() req: any) {
    return this.dfService.applyMapping(body.records, req.user.userId, req.user.email);
  }

  @Get('policy')
  getPolicy(@Req() req: any) {
    return this.dfService.getPolicy(req.user.userId);
  }

  @Post('policy')
  savePolicy(@Body() body: any, @Req() req: any) {
    return this.dfService.savePolicy(req.user.userId, req.user.email, body);
  }

  @Post('decide/run')
  runDecisions(@Body() body: any, @Req() req: any) {
    return this.dfService.runDecisionEngine(req.user.userId, req.user.email, body);
  }

  @Post('opportunities/:id/fetch-context')
  fetchExternalContext(@Param('id') id: string, @Req() req: any) {
    return this.dfService.fetchExternalContext(id, req.user.userId, req.user.email);
  }

  @Post('twin/simulate')
  simulateTwin(@Body() body: any, @Req() req: any) {
    return this.dfService.simulateTwin(body, req.user.userId);
  }

  @Post('recommendations/:id/approve')
  approveAction(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.reviewAction(id, 'APPROVED', body, req.user.userId, req.user.email);
  }

  @Post('recommendations/:id/modify')
  modifyAction(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.reviewAction(id, 'MODIFIED', body, req.user.userId, req.user.email);
  }

  @Post('recommendations/:id/reject')
  rejectAction(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.reviewAction(id, 'REJECTED', body, req.user.userId, req.user.email);
  }

  @Post('recommendations/:id/convert-to-client')
  convertToClient(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.convertToClient(id, body, req.user.userId, req.user.email);
  }

  @Get('audit')
  getAuditLogs(@Req() req: any) {
    return this.dfService.getAuditLogs(req.user.userId);
  }

  @Get('approvals')
  getApprovals(@Req() req: any) {
    return this.dfService.getApprovals(req.user.userId);
  }

  @Get('replay/:runId')
  replayDecision(@Param('runId') runId: string) {
    return this.dfService.replayDecision(runId);
  }
}
