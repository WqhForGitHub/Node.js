import { Injectable } from '@nestjs/common';
@Injectable()
export class OutboxService {
  private messages: any[] = [];
  publish(msg: any) {
    this.messages.push({
      ...msg,
      id: this.messages.length + 1,
      sent: false,
      createdAt: new Date().toISOString(),
    });
    return { queued: true, id: this.messages.length };
  }
  pending() {
    return this.messages.filter((m) => !m.sent);
  }
  markSent(id: number) {
    const m = this.messages.find((x) => x.id === id);
    if (m) m.sent = true;
  }
}
