import * as fs from 'fs';
import * as path from 'path';
import { ENFORCEMENT_MODES, KIT_PATH } from '../constants.js';
import { blockAction, noOp } from '../utils.js';
import type { SecurityPolicy } from '../../types/security.js';

export function enforce(reason: string, policy: Pick<SecurityPolicy, 'enforcementMode'>): void {
  if (policy.enforcementMode === ENFORCEMENT_MODES.AUDIT) {
    try {
      const logPath = path.join(KIT_PATH, 'logs', 'security-audit.log');
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] AUDIT: ${reason}\n`);
    } catch {
      // Never block on logging failure
    }
    noOp();
  } else {
    blockAction(reason);
  }
}
