import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  private files: any[] = [];
  save(file: any) {
    if (!file) return { error: 'no file' };
    const record = {
      original: file.originalname,
      saved: file.filename,
      size: file.size,
    };
    this.files.push(record);
    return record;
  }
  list() {
    return this.files;
  }
}
