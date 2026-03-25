/* eslint-disable no-undef */
import { execSync } from 'child_process';

export function countTests(projectDir = process.cwd()) {
  try {
    execSync('which rg', { stdio: 'ignore' });
  } catch {
    return 0;
  }

  const patterns = [
    '--glob "**/*.test.[tj]s{x,}"',
    '--glob "**/*.spec.[tj]s{x,}"',
    '--glob "**/__tests__/**/*"',
  ];
  const excludeGlob =
    '--glob "!node_modules/*" --glob "!dist/*" --glob "!build/*" --glob "!.git/*"';

  try {
    const command = `rg -l "." ${patterns.join(' ')} ${excludeGlob} . | wc -l`;
    const result = execSync(command, {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}
