import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
describe('AppController (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  it('/calc/add/2/3 (GET)', () =>
    request(app.getHttpServer()).get('/calc/add/2/3').expect(200).expect({ result: 5 }));
  afterAll(() => app.close());
});
