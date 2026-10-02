import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AssistantService } from './assistant.service';

/** The in-app assistant. Every route is authenticated; tools only ever read the caller's own data. */
@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('status')
  status() {
    return this.assistant.status();
  }

  @Post('chat')
  chat(@Body() body: any, @Req() req: any) {
    return this.assistant.chat(body?.message, req.user.userId, req.user.email);
  }
}
