import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/**
 * Browser origins allowed to call the API. `CORS_ORIGINS` is a comma-separated list (set it to the
 * deployed frontend's address in production). When it is unset every origin is allowed, which is what
 * local development needs. The API authenticates with a bearer token in a header, not a cookie, so a
 * foreign page cannot make a signed-in request on a user's behalf either way.
 */
export function allowedOrigins(raw = process.env.CORS_ORIGINS): string[] | '*' {
  const list = (raw || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length ? list : '*';
}

/** Security headers and CORS, shared by the long-running server (main.ts) and the serverless entry (api/index.js). */
export function configureHttp(app: INestApplication): void {
  app.use(helmet());
  app.enableCors({ origin: allowedOrigins() });
}
