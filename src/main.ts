// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino'; // Assuming you're using nestjs-pino
import { CorrelationIdMiddleware } from './utils/correlation-id.middleware';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true, // Enable CORS directly here
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.disable('x-powered-by');

  app.use(CorrelationIdMiddleware());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true, // Optional: automatically transform payloads to DTO instances
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('ABI ISP API Docs')
    .setDescription('API description for ABI ISP backend')
    .setVersion('1.0')
    .addTag('apidocs')
    .addBearerAuth() // Add Bearer token auth for protected endpoints
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const configService = app.get<ConfigService>(ConfigService);
  const port = configService.get<number>('port');

  app.enableShutdownHooks();

  const hostname = '0.0.0.0';

  await app.listen(port, hostname, () => {
    logger.log(`Server listening on ${hostname}:${port}`);
  });
}

bootstrap();
