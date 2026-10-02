import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureBodyLimits } from './common/body-limits';
import { configureHttp } from './common/http-setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureBodyLimits(app);
  configureHttp(app);
  app.setGlobalPrefix('api');
  const port = process.env.PORT || 3001;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `Gateway listening on http://localhost:${port}/api`,
  );
}
void bootstrap();
