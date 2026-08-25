export class Account {
  balance = 0;
  apply(event: { type: string; data: any }) {
    if (event.type === 'deposited') this.balance += event.data.amount;
    if (event.type === 'withdrawn') this.balance -= event.data.amount;
  }
}
