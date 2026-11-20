import type { TestInfo } from '@playwright/test';

/** Leaves a measurement in the report (HTML) and prints it, so a `list` run shows it too. */
export function reportMeasure(testInfo: TestInfo, type: string, text: string): void {
  testInfo.annotations.push({ type, description: text });
  process.stdout.write(`    [${type}] ${text}\n`);
}
