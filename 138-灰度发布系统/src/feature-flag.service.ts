import { Injectable } from '@nestjs/common';
@Injectable()
export class FeatureFlagService {
  private flags: Record<string, number> = { 'new-ui': 30, 'beta-api': 10 };
  isEnabled(flag: string, userId: number) {
    const pct = this.flags[flag] || 0;
    return userId % 100 < pct;
  }
}
