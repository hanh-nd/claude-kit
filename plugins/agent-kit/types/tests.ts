export interface ChildRunResult {
  exitCode: number | string | undefined;
  stderr: string;
}

export interface ExitExpectation {
  exitCode: number;
}

export interface SecurityCase {
  name: string;
  payload: unknown;
  expect: ExitExpectation;
  raw?: string;
}
