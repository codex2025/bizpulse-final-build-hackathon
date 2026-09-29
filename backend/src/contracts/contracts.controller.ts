import { Controller, Post, Get, Param, Body, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ContractsService } from './contracts.service';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post('analyze')
  @UseInterceptors(FileInterceptor('document'))
  analyzeContract(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('No contract document provided in multipart form data (field name: document)');
    }
    return this.contractsService.analyzeContract(file, req.user.userId);
  }

  @Post(':id/ask')
  askQuestion(
    @Param('id') id: string,
    @Body('question') question: string,
    @Body('top_k') topK: number,
    @Body('language') language: string,
    @Req() req: any,
  ) {
    return this.contractsService.askQuestion(id, req.user.userId, question, topK || 4, language || 'en');
  }

  @Get('languages')
  getLanguages() {
    return this.contractsService.getLanguages();
  }

  @Post('translate')
  translateContract(
    @Body('contract_data') contractData: any,
    @Body('target_language') targetLanguage: string,
  ) {
    if (!contractData || !targetLanguage) {
      throw new BadRequestException('contract_data and target_language are required');
    }
    return this.contractsService.translateContract(contractData, targetLanguage);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.contractsService.findAll(req.user.userId);
  }

  @Get(':id/queries')
  getQueries(@Param('id') id: string, @Req() req: any) {
    return this.contractsService.getQueries(id, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.contractsService.findOne(id, req.user.userId);
  }

  @Post(':id/delete')
  deleteContract(@Param('id') id: string, @Req() req: any) {
    return this.contractsService.deleteContract(id, req.user.userId);
  }
}
