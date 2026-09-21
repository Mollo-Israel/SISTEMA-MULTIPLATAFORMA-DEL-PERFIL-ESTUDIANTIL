import 'reflect-metadata';
// Antes de importar la aplicacion: los limites de @Throttle se evaluan al
// importar los controladores, y necesitan el .env ya cargado.
import './load-env';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { resolveCorsOptions } from './config/security.config';
import { assertEnvironment } from './config/environment.check';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // §84: validar el entorno al iniciar. Mejor no arrancar que arrancar mal.
  assertEnvironment(config);

  app.setGlobalPrefix('api');

  // §84: cabeceras de seguridad. `contentSecurityPolicy` se desactiva porque
  // esta API no sirve HTML; la CSP la aplica el cliente web en su propio host.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  // Los archivos NO se sirven como estáticos (§83). La descarga pasa por
  // FilesController, que exige sesión y comprueba la autorización sobre la
  // entidad que contiene el archivo.

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors(resolveCorsOptions(config));

  // Necesario para que el rate limit y el registro de sesión vean la IP real
  // cuando la API está detrás de un proxy inverso.
  app.set('trust proxy', 1);

  // §110: Swagger deshabilitable en producción.
  const swaggerEnabled =
    (config.get<string>('SWAGGER_ENABLED') ?? '').toLowerCase() === 'true'
    || (config.get<string>('NODE_ENV') ?? 'development') !== 'production';

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Afinia — API')
      .setDescription(
        'API de Afinia: construcción de la trayectoria académica complementaria del '
          + 'estudiante. Identidad provisionada, perfil dinámico, actividades, portafolio, '
          + 'afinidad explicable y recomendaciones.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  } else {
    logger.log('Swagger deshabilitado en este entorno.');
  }

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
  logger.log(`Afinia API escuchando en el puerto ${port}`);
}

bootstrap();
