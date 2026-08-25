export class OrderItem {
  constructor(
    public productId: number,
    public qty: number,
    public price: number
  ) {}
}
export class Order {
  private items: OrderItem[] = [];
  constructor(
    public id: number,
    public customerId: number
  ) {}
  addItem(item: OrderItem) {
    this.items.push(item);
  }
  total() {
    return this.items.reduce((s, i) => s + i.qty * i.price, 0);
  }
  toSnapshot() {
    return {
      id: this.id,
      customerId: this.customerId,
      items: this.items,
      total: this.total(),
    };
  }
}
