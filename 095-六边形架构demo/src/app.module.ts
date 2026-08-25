import { Module } from '@nestjs/common';
import { HttpUserController } from './adapters/http.controller';
import { CoreUserService } from './core/user.service';
import { InMemoryUserAdapter } from './adapters/in-memory.adapter';
import { UserPort } from './core/ports';
@Module({
  controllers: [HttpUserController],
  providers: [
    CoreUserService,
    InMemoryUserAdapter,
    { provide: UserPort, useExisting: InMemoryUserAdapter },
  ],
})
export class AppModule {}
