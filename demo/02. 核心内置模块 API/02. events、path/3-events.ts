/**
 * Demo 3 - events 事件触发器
 * 运行：node "demo/02. 核心内置模块 API/3-events.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EventEmitter } = require('node:events') as typeof import('node:events');

async function eventsMain(): Promise<void> {
  const emitter = new EventEmitter();

  // 1. on 注册监听，emit 触发，参数跟在事件名后面（可触发多次）
  emitter.on('greet', (name: string) => console.log(`你好, ${name}`));
  emitter.emit('greet', 'Tom');

  // 2. once 只触发一次；off 移除监听
  emitter.once('first', () => console.log('我只触发一次'));
  emitter.emit('first');
  emitter.emit('first'); // 第二次没有输出

  const listener = (word: string): void => console.log('说:', word);
  emitter.on('talk', listener);
  emitter.emit('talk', 'hello');
  emitter.off('talk', listener);
  emitter.emit('talk', 'world'); // 已被移除，没有输出

  // 3. listenerCount / eventNames：查看监听器（单个事件超过 10 个会告警）
  emitter.on('data', () => {});
  emitter.on('data', () => {});
  console.log(
    'data 监听器数:',
    emitter.listenerCount('data'),
    '| 已注册事件:',
    emitter.eventNames()
  );
  emitter.removeAllListeners('data');

  // 4. error 是特殊事件：没有监听器时 emit 会直接抛出异常
  emitter.on('error', (err: Error) => console.log('捕获:', err.message));
  emitter.emit('error', new Error('磁盘满了'));

  // 5. 继承 EventEmitter：流、net、http 模块的共同底座
  class Counter extends EventEmitter {
    private n = 0;

    add(): void {
      this.emit('change', ++this.n);
    }
  }

  const counter = new Counter();
  counter.on('change', (n: number) => console.log('count:', n));
  counter.add();
  counter.add();

  // 6. EventEmitter.once：把「下一次事件」变成 Promise
  const boot = new EventEmitter();
  setTimeout(() => boot.emit('ready', '启动完成'), 100);
  const [msg] = await EventEmitter.once(boot, 'ready');
  console.log('收到:', msg);
}

eventsMain();
