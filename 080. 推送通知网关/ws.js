// WebSocket 协议
const crypto = require('crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function handshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  const accept = crypto
    .createHash('sha1')
    .update(key + GUID)
    .digest('base64');
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n',
    ].join('\r\n')
  );
}

function encode(data) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  const payload = Buffer.from(json);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x81;
  return Buffer.concat([header, payload]);
}

function decode(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  if (opcode === 0x8) return { opcode: 'close' };
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) {
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  let mask;
  if (masked) {
    mask = buf.slice(offset, offset + 4);
    offset += 4;
  }
  if (buf.length < offset + len) return null;
  const payload = buf.slice(offset, offset + len);
  if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return { opcode, payload, total: offset + len };
}

class WSConnection {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.handlers = {};
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (true) {
        const frame = decode(this.buffer);
        if (!frame) break;
        if (frame.opcode === 'close') return this.close();
        this.buffer = this.buffer.slice(frame.total);
        try {
          (this.handlers.message || []).forEach((h) => h(JSON.parse(frame.payload.toString())));
        } catch (_) {}
      }
    });
    socket.on('close', () => (this.handlers.close || []).forEach((h) => h()));
    socket.on('error', () => (this.handlers.close || []).forEach((h) => h()));
  }
  on(event, handler) {
    (this.handlers[event] = this.handlers[event] || []).push(handler);
  }
  send(data) {
    try {
      this.socket.write(encode(data));
    } catch (_) {}
  }
  close() {
    try {
      this.socket.end();
    } catch (_) {}
  }
}

module.exports = { handshake, WSConnection };
