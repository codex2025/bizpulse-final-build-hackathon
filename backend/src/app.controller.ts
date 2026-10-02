import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AppService } from './app.service';
import { normalizeServiceUrl } from './decision-forge/decision-forge.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  getHello() {
    return {
      status: 'healthy',
      name: 'Bizpulse Fintech Gateway API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      service: 'bizpulse-backend-gateway',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Liveness of the gateway and the AI service, for the status pill in the UI. Reports only
   * up/down and latency: no URLs, versions or credentials.
   */
  @Get('health/services')
  async getServiceHealth() {
    const aiUrl = normalizeServiceUrl(
      this.config.get('AI_SERVICE_URL', 'http://localhost:8000'),
    );
    const started = Date.now();
    let ai: 'up' | 'down' = 'down';
    try {
      const res = await axios.get(`${aiUrl}/health`, { timeout: 2000 });
      ai = res.data?.status === 'healthy' ? 'up' : 'down';
    } catch {
      ai = 'down';
    }
    return {
      gateway: 'up' as const,
      ai,
      aiLatencyMs: ai === 'up' ? Date.now() - started : null,
      timestamp: new Date().toISOString(),
    };
  }
}
