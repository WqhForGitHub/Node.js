// 生成自签名证书：node scripts/generate-cert.mjs
import selfsigned from 'selfsigned';
import fs from 'node:fs';

const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
  days: 365,
  keySize: 2048,
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ],
    },
  ],
});

fs.mkdirSync('certs', { recursive: true });
fs.writeFileSync('certs/server.key', pems.private);
fs.writeFileSync('certs/server.crt', pems.cert);
console.log('Generated certs/server.key and certs/server.crt');
