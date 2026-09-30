/**
 * Vercel Node entrypoint. Plain JS on purpose: NestJS's dependency injection
 * relies on TypeScript's `emitDecoratorMetadata`, which the esbuild transform
 * Vercel would otherwise use to compile an api/*.ts file on the fly does not
 * implement. Building the app for real first (`nest build`, tsc-based, run as
 * part of the Vercel build step below) and just `require`-ing the compiled
 * output here sidesteps that gap entirely.
 *
 * The Nest app itself is created once and cached across warm invocations of
 * the same function instance, exactly as main.ts's `app.listen(...)` would
 * keep one process running -- only the transport differs (Vercel hands us
 * (req, res) directly instead of us opening a port).
 */
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { configureBodyLimits } = require('../dist/common/body-limits');

let cachedApp;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  configureBodyLimits(app);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  await app.init();
  return app.getHttpAdapter().getInstance();
}

module.exports = async (req, res) => {
  if (!cachedApp) {
    // If bootstrap fails, clear the cache so the next request gets a fresh
    // attempt instead of every request failing until the function cold-starts.
    cachedApp = bootstrap().catch((err) => {
      cachedApp = undefined;
      throw err;
    });
  }
  const expressApp = await cachedApp;
  expressApp(req, res);
};
