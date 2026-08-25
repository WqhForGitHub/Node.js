import { Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AppService } from './app.service';
@Controller('files')
export class AppController {
  constructor(private readonly app: AppService) {}
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
    })
  )
  upload(@UploadedFile() file: any) {
    return this.app.save(file);
  }
  @Get('list') list() {
    return this.app.list();
  }
}
