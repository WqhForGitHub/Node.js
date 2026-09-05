/**
 * events — Node.js 事件驱动的核心
 * EventEmitter = 发布/订阅模式：on 注册监听器，emit 触发事件
 */
import { EventEmitter } from "node:events";

// ---------- 1. 最简用法：直接 new 一个事件中心 ----------
const bus = new EventEmitter();

bus.on("ping", (from: string) => {
  console.log(`收到 ping，来自：${from}`);
});

bus.emit("ping", "客户端A");
bus.emit("ping", "客户端B");

// ---------- 2. 常规用法：继承 EventEmitter，让类具备事件能力 ----------
class PizzaShop extends EventEmitter {
  order(flavor: string): void {
    console.log(`\n[门店] 接到订单：${flavor} 披萨`);
    this.emit("order", flavor); // 触发事件，通知所有监听器
  }
}

const shop = new PizzaShop();

shop.on("order", (flavor: string) => {
  console.log(`[厨师] 开始做 ${flavor} 披萨`);
});

// once：只监听一次，触发后自动移除
shop.once("order", () => {
  console.log("[门铃] 叮咚！新订单来了（once 演示，只响一次）");
});

// 特殊事件 error：有监听则交给监听器，没有则直接抛出崩溃
shop.on("error", (err: Error) => {
  console.error(`[处理错误] ${err.message}`);
});

shop.order("玛格丽特");
shop.order("夏威夷"); // 第二次不再触发 once 的监听器

// ---------- 3. 查看与移除监听器 ----------
console.log("\norder 事件的监听器数量:", shop.listenerCount("order"));
shop.emit("error", new Error("烤箱冒烟了！"));

const handler = () => console.log("[临时] 这个监听器马上会被移除");
shop.on("order", handler);
shop.off("order", handler); // off = removeListener 的别名
shop.order("榴莲"); // handler 已移除，不会打印
