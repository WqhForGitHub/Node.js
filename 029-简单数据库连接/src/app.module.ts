import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordModule } from './record/record.module';
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      autoLoadEntities: true,
    }),
    RecordModule,
  ],
})
export class AppModule {}
