import { Injectable, BadRequestException } from '@nestjs/common';
@Injectable()
export class SagaOrchestrator {
  private log: any[] = [];
  async run(steps: { name: string; run: () => any; compensate: () => any }[]) {
    const done: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      try {
        await steps[i].run();
        done.push(i);
        this.log.push({ step: steps[i].name, status: 'done' });
      } catch (e) {
        this.log.push({ step: steps[i].name, status: 'failed' });
        for (let j = done.length - 1; j >= 0; j--) {
          await steps[done[j]].compensate();
          this.log.push({ step: steps[done[j]].name, status: 'compensated' });
        }
        throw new BadRequestException('Saga failed, compensated');
      }
    }
    return { ok: true, log: this.log };
  }
  getLog() {
    return this.log;
  }
}
