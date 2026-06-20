import express, { Request, Response } from 'express';
import multer from 'multer';

/**
 * 图片存储API
 * Express + TypeScript 文件上传示例
 * 注意: 需要 multer 依赖
 */
const app = express();
app.use(express.json());

// 内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

interface FileRecord {
  id: number;
  originalname: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
}

const files: FileRecord[] = [];
let nextId = 1;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '图片存储API' });
});

// 单文件上传
app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: '请上传文件' });
    return;
  }
  const record: FileRecord = {
    id: nextId++,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date().toISOString(),
  };
  files.push(record);
  res.status(201).json(record);
});

// 多文件上传
app.post('/api/uploads', upload.array('files', 10), (req: Request, res: Response) => {
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];
  if (uploadedFiles.length === 0) {
    res.status(400).json({ message: '请上传文件' });
    return;
  }
  const records = uploadedFiles.map((f) => {
    const record: FileRecord = {
      id: nextId++,
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      uploadedAt: new Date().toISOString(),
    };
    files.push(record);
    return record;
  });
  res.status(201).json(records);
});

// 文件列表
app.get('/api/files', (_req: Request, res: Response) => {
  res.json(files);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[图片存储API] running at http://localhost:' + PORT);
});
