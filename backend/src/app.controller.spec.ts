import axios from 'axios';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

const build = (aiUrl?: string) =>
  new AppController({} as never, { get: (_k: string, d: string) => aiUrl ?? d } as never);

describe('AppController root', () => {
  it('reports a healthy gateway', async () => {
    const app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: ConfigService, useValue: { get: (_k: string, d: string) => d } }],
    }).compile();
    expect(app.get(AppController).getHello()).toMatchObject({ status: 'healthy', name: 'Bizpulse Fintech Gateway API' });
  });
});

describe('AppController service health', () => {
  afterEach(() => mockedGet.mockReset());

  it('reports the AI service up with a latency when it answers healthy', async () => {
    mockedGet.mockResolvedValue({ data: { status: 'healthy' } });
    const res = await build('ai-host:10000').getServiceHealth();
    expect(res.gateway).toBe('up');
    expect(res.ai).toBe('up');
    expect(typeof res.aiLatencyMs).toBe('number');
    // A scheme-less Render hostport is normalised, and only /health is called.
    expect(mockedGet).toHaveBeenCalledWith('http://ai-host:10000/health', { timeout: 2000 });
  });

  it('reports the AI service down (never throws) when it cannot be reached', async () => {
    mockedGet.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await build().getServiceHealth();
    expect(res).toMatchObject({ gateway: 'up', ai: 'down', aiLatencyMs: null });
  });

  it('reports down when the AI service answers with an unhealthy status', async () => {
    mockedGet.mockResolvedValue({ data: { status: 'degraded' } });
    expect((await build().getServiceHealth()).ai).toBe('down');
  });

  it('exposes no URL, version or credential in the response', async () => {
    mockedGet.mockResolvedValue({ data: { status: 'healthy', version: '9.9.9' } });
    const res = await build('http://secret-host:8000').getServiceHealth();
    expect(JSON.stringify(res)).not.toMatch(/secret-host|9\.9\.9/);
  });
});
