import { Injectable } from '@nestjs/common';
import { EventStore } from './event.store';
import { Account } from './account.aggregate';
@Injectable()
export class AccountService {
  constructor(private store: EventStore) {}
  deposit(id: string, amount: number) {
    this.store.append(id, 'deposited', { amount });
    return this.replay(id);
  }
  withdraw(id: string, amount: number) {
    this.store.append(id, 'withdrawn', { amount });
    return this.replay(id);
  }
  replay(id: string) {
    const acc = new Account();
    this.store.load(id).forEach((e) => acc.apply(e));
    return { id, balance: acc.balance };
  }
}
