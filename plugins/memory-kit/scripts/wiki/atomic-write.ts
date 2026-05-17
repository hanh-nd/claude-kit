import * as fs from 'node:fs';
import * as path from 'node:path';

export function atomicWriteJSON(targetPath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, targetPath);
}
