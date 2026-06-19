import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { SwaggerSetupOptions } from './swagger.interfaces.js';

export function setupSwaggerUI(
  app: INestApplication,
  options: SwaggerSetupOptions,
): void {
  const path = (options.path || 'api-docs').replace(/^\/+|\/+$/g, '');

  const config = new DocumentBuilder()
    .setTitle(options.title || 'API Documentation')
    .setDescription(options.description || '')
    .setVersion(options.version || '1.0');

  if (options.serverUrl) {
    config.addServer(options.serverUrl, options.serverDescription);
  }

  const document = SwaggerModule.createDocument(app, config.build());

  app.use(
    `/${path}`,
    apiReference({
      content: document,
      ...(options.persistAuth && { persistAuth: true }),
    }),
  );
}
