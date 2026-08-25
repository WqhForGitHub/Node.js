import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Declare process for environments where @types/node is not available
declare const process: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log('Application running on http://localhost:' + port);
}
bootstrap();
