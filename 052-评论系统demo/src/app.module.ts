import { Module } from '@nestjs/common';
import { CommentModule } from './comment/comment.module';
@Module({ imports: [CommentModule] })
export class AppModule {}
