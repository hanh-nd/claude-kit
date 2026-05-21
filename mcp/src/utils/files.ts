import * as fs from 'node:fs';
import * as path from 'node:path';

export function atomicWriteTextFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function atomicWriteJsonFile(filePath: string, value: unknown): void {
  atomicWriteTextFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
