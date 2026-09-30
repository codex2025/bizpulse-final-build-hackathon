import { Body, Controller, INestApplication, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AddressInfo } from 'net';
import { configureBodyLimits } from './body-limits';

/** A tiny real Nest app, bootstrapped the way main.ts does, so Nest's own parser registration is exercised. */
@Controller('decision-forge')
class EchoController {
  @Post('ingest/apply-mapping')
  apply(@Body() body: any) {
    return { received: body?.records?.length ?? -1 };
  }

  @Post('decisions/query')
  query(@Body() body: any) {
    return { received: body?.records?.length ?? -1, question: body?.question ?? null };
  }
}

@Module({ controllers: [EchoController] })
class EchoModule {}

const records = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ company_name: `Customer ${i}`, notes: 'x'.repeat(300) }));

describe('request body limits (real Nest bootstrap)', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    app = await NestFactory.create(EchoModule, { logger: false });
    configureBodyLimits(app as any);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/decision-forge`;
  });
  afterAll(async () => { await app.close(); });

  const post = (path: string, body: any) =>
    fetch(`${url}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('accepts a multi-thousand-row upload on apply-mapping (this was a 413 before)', async () => {
    const body = { records: records(3000) };                        // ~1 MB of JSON
    expect(JSON.stringify(body).length).toBeGreaterThan(900_000);
    const res = await post('ingest/apply-mapping', body);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: 3000 });
  });

  it('still rejects bodies over the scoped limit', async () => {
    expect((await post('ingest/apply-mapping', { records: records(25000) })).status).toBe(413);   // ~8 MB
  });

  it('keeps the small default limit on every other route', async () => {
    expect((await post('decisions/query', { records: records(1000) })).status).toBe(413);          // ~330 KB
  });

  it('REGRESSION: every other route still receives its parsed JSON body', async () => {
    // Registering body-parser's json() directly made Nest skip its own global parser, so /auth/login
    // (and everything else) saw `body === undefined`.
    const res = await post('decisions/query', { question: 'hello' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: -1, question: 'hello' });
  });
});
