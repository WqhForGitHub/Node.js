import fs from 'fs/promises';

async function readJsonFile() {
  try {
    const buffer = await fs.readFile('./config.json', 'utf-8');
    const data = JSON.parse(buffer);
    console.log(data);
  } catch (e) {
    console.error('读取/解析json失败', e);
  }
}

readJsonFile();
