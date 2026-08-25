import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  private cfg: any = { value: 1 };
  config() {
    return this.cfg;
  }
  reload() {
    this.cfg = {
      value: this.cfg.value + 1,
      reloadedAt: new Date().toISOString(),
    };
    return { ok: true, config: this.cfg };
  }
}
