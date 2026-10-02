import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DecisionForgeService } from './decision-forge.service';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Every route is authenticated and scoped to the caller: userId is the workspace id. */
@Controller('decision-forge')
@UseGuards(JwtAuthGuard)
export class DecisionForgeController {
  constructor(private readonly dfService: DecisionForgeService) {}

  @Get('workspace')
  getWorkspace(@Req() req: any) {
    return this.dfService.getWorkspaceStatus(req.user.userId);
  }

  @Post('workspace/clear')
  clearWorkspace(@Req() req: any) {
    return this.dfService.clearWorkspace(req.user.userId, req.user.email);
  }

  @Get('dataset')
  getDataset(@Req() req: any) {
    return this.dfService.getDataset(req.user.userId);
  }

  @Get('datasets')
  getDatasets() {
    return this.dfService.getDatasets();
  }

  @Get('quality')
  getQuality(@Req() req: any) {
    return this.dfService.getQuality(req.user.userId);
  }

  @Get('summary')
  getSummary(@Req() req: any) {
    return this.dfService.getSummary(req.user.userId, req.user.email);
  }

  @Post('reset-demo')
  resetDemo(@Body() body: any, @Req() req: any) {
    return this.dfService.resetDemoData(
      req.user.userId,
      req.user.email,
      body?.dataset,
      body?.clearHistory === true,
    );
  }

  @Post('ingest/file')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  ingestFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.dfService.ingestFile(file, req.user.userId, req.user.email);
  }

  @Post('ingest/apply-mapping')
  applyMapping(@Body() body: { records: any[] }, @Req() req: any) {
    return this.dfService.applyMapping(
      body?.records,
      req.user.userId,
      req.user.email,
    );
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
    return this.dfService.runDecisionEngine(
      req.user.userId,
      req.user.email,
      body,
    );
  }

  @Post('decisions/query')
  queryDecision(
    @Body() body: any,
    @Query('preset') preset: string,
    @Req() req: any,
  ) {
    return this.dfService.queryDecision(
      body?.question,
      req.user.userId,
      req.user.email,
      preset || body?.preset,
    );
  }

  @Get('decisions')
  listDecisions(@Req() req: any) {
    return this.dfService.listDecisions(req.user.userId);
  }

  @Get('decisions/:runId')
  getDecision(@Param('runId') runId: string, @Req() req: any) {
    return this.dfService.replayDecision(runId, req.user.userId);
  }

  @Get('decisions/:runId/evidence')
  getEvidence(
    @Param('runId') runId: string,
    @Query('opportunityId') opportunityId: string,
    @Req() req: any,
  ) {
    return this.dfService.getEvidence(runId, req.user.userId, opportunityId);
  }

  @Post('opportunities/:id/fetch-context')
  fetchExternalContext(@Param('id') id: string, @Req() req: any) {
    return this.dfService.fetchExternalContext(
      id,
      req.user.userId,
      req.user.email,
    );
  }

  @Post('twin/simulate')
  simulateTwin(@Body() body: any, @Req() req: any) {
    return this.dfService.simulateTwin(body, req.user.userId);
  }

  @Post('recommendations/:id/review')
  startReview(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.startReview(
      id,
      body,
      req.user.userId,
      req.user.email,
    );
  }

  @Post('recommendations/:id/approve')
  approveAction(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.reviewAction(
      id,
      'APPROVED',
      body,
      req.user.userId,
      req.user.email,
    );
  }

  @Post('recommendations/:id/modify')
  modifyAction(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.reviewAction(
      id,
      'MODIFIED',
      body,
      req.user.userId,
      req.user.email,
    );
  }

  @Post('recommendations/:id/reject')
  rejectAction(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.reviewAction(
      id,
      'REJECTED',
      body,
      req.user.userId,
      req.user.email,
    );
  }

  @Post('recommendations/:id/convert-to-client')
  convertToClient(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.dfService.convertToClient(
      id,
      body,
      req.user.userId,
      req.user.email,
    );
  }

  @Get('audit')
  getAuditLogs(@Req() req: any) {
    return this.dfService.getAuditLogs(req.user.userId);
  }

  @Get('approvals')
  getApprovals(@Req() req: any) {
    return this.dfService.getApprovals(req.user.userId);
  }

  /** Kept for the existing UI; same ownership-checked replay as GET decisions/:runId. */
  @Get('replay/:runId')
  replayDecision(@Param('runId') runId: string, @Req() req: any) {
    return this.dfService.replayDecision(runId, req.user.userId);
  }
}
