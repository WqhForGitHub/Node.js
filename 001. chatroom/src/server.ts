import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocket, WebSocketServer } from 'ws';

// 创建 http 服务，返回聊天室
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const htmlPath = path.join(__dirname, '../public/index.html');
    fs.readFile(htmlPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('加载页面失败');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
      res.end(data);
    })
  }
});

// websocket 服务挂载到 http server
const wss = new WebSocketServer({ server });

interface ChatMessage {
  type: 'chat' | 'join';
  nickname: string;
  content: string;
}

function broadcast(msg: ChatMessage) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(msg));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('有客户端连接进来');

  ws.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData.toString()) as ChatMessage;
      broadcast(data);
    } catch (e) {
      console.error('消息解析错误', e);
    }
  });

  ws.on('close', () => {
    console.log('客户端断开连接');
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`聊天室运行在 http://localhost:${PORT}`);
})
