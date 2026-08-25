import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { FileModule } from './file/file.module';
import { FolderModule } from './folder/folder.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, FileModule, FolderModule, StatsModule] })
export class AppModule {}
