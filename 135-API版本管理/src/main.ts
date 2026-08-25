import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableVersioning({ type: VersioningType.URI });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log('Application running on http://localhost:' + port);
}
bootstrap();
