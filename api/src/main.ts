import 'reflect-metadata';
// Antes de importar la aplicacion: los limites de @Throttle se evaluan al
// importar los controladores, y necesitan el .env ya cargado.
import './load-env';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { mensajesDeValidacion } from './common/validation-messages';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';
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

  // V2 BATCH 16: compresión de respuestas. La prueba de carga mostró listados
  // de varios MB en JSON; comprimidos ocupan una fracción. Umbral de 1 KB: lo
  // pequeño no gana nada y gasta CPU.
  app.use(compression({ threshold: 1024 }));

  // Los archivos NO se sirven como estáticos (§83). La descarga pasa por
  // FilesController, que exige sesión y comprueba la autorización sobre la
  // entidad que contiene el archivo.

  /*
    * §84: límite del cuerpo. Las subidas van por `multipart` con su propio
    * tope; esto acota el JSON, donde un cuerpo enorme no tiene ningún uso
    * legítimo y sí sirve para agotar la memoria del proceso.
    */
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: true, limit: '256kb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Los mensajes que la librería redacta sola vienen en inglés. Se
      // traducen en un solo sitio: ponerlos decorador por decorador serían
      // doscientas ediciones que además hay que repetir en cada DTO nuevo.
      exceptionFactory: mensajesDeValidacion,
    }),
  );

  // §103: una sola forma de error para toda la API. §102: el registro de cada
  // petición, sin tocar cuerpos ni cabeceras.
  app.useGlobalFilters(new HttpExceptionFilter(config));
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
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
        'API de Afinia (Especificación Maestra V3.1): trayectoria académica complementaria '
          + 'del estudiante. Identidad provisionada, perfil dinámico, oportunidades internas y '
          + 'externas, proyectos con corroboración técnica, credenciales validadas por niveles, '
          + 'afinidad V4 y respaldo, recomendaciones, notificaciones, necesidades de equipo con '
          + 'postulaciones, trayectoria y currículo seleccionable, y analítica por actor. '
          + 'Los listados con `limit` devuelven `{ items, total, limit, offset }`.',
      )
      .setVersion('3.1.0')
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
