import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureBodyLimits } from './common/body-limits';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureBodyLimits(app);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api`);
}
bootstrap();
