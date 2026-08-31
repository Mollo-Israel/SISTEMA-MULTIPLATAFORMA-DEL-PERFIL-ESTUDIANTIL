import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { resolveCorsOptions } from './config/security.config';
import { LocalStorageDriver } from './storage/local-storage.driver';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // Archivos de evidencia subidos por los estudiantes.
  // Van fuera del prefijo global porque no son rutas de la API sino contenido.
  app.useStaticAssets(LocalStorageDriver.resolveRoot(config), { prefix: '/api/files/' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors(resolveCorsOptions(config));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Perfil Estudiantil Dinámico')
    .setDescription('API central del 30% inicial. Autenticación, usuarios y roles.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
}

bootstrap();
