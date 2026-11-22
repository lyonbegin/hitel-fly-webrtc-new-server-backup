import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  const origins = (config.get<string>('CORS_ORIGINS') ?? '*')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = Number(config.get<string>('PORT') ?? 8080);
  await app.listen(port, '0.0.0.0');
  console.log(`Realtime server listening on :${port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
