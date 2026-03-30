import * as fs from "fs/promises";
import * as path from "path";
import sharp from "sharp";
import type { TestResult } from "../types/index.js";

const TEST_RESULTS_DIR = path.join(process.cwd(), "test-results");
const SCREENSHOTS_DIR = path.join(process.cwd(), "screenshots");

/**
 * Ensures the test-results and screenshots directories exist
 */
export async function ensureDirectories(): Promise<void> {
  await fs.mkdir(TEST_RESULTS_DIR, { recursive: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Generates a filename for a test result
 */
function generateFilename(issueId: string, timestamp: string): string {
  const safeTimestamp = timestamp.replace(/[:.]/g, "-");
  return `${issueId}-${safeTimestamp}.json`;
}

/**
 * Saves a test result to a JSON file
 */
export async function saveTestResult(result: TestResult): Promise<string> {
  await ensureDirectories();

  const filename = generateFilename(result.issueId, result.timestamp);
  const filepath = path.join(TEST_RESULTS_DIR, filename);

  await fs.writeFile(filepath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`[Storage] Test result saved to ${filepath}`);
  return filepath;
}

/**
 * Loads a test result from a JSON file
 */
export async function loadTestResult(filename: string): Promise<TestResult> {
  const filepath = path.join(TEST_RESULTS_DIR, filename);
  const content = await fs.readFile(filepath, "utf-8");
  return JSON.parse(content) as TestResult;
}

/**
 * Lists all test result files
 */
export async function listTestResults(): Promise<string[]> {
  await ensureDirectories();

  const files = await fs.readdir(TEST_RESULTS_DIR);
  return files.filter((f) => f.endsWith(".json")).sort().reverse();
}

/**
 * Gets test results for a specific issue
 */
export async function getResultsForIssue(issueId: string): Promise<TestResult[]> {
  const allFiles = await listTestResults();
  const issueFiles = allFiles.filter((f) => f.startsWith(issueId));

  const results: TestResult[] = [];
  for (const file of issueFiles) {
    const result = await loadTestResult(file);
    results.push(result);
  }

  return results;
}

/**
 * Saves a screenshot and returns its path
 */
export async function saveScreenshot(
  issueId: string,
  screenshotData: Buffer,
  index: number
): Promise<string> {
  await ensureDirectories();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${issueId}-${timestamp}-${index}.webp`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  const webpBuffer = await sharp(screenshotData).webp({ quality: 65 }).toBuffer();
  await fs.writeFile(filepath, webpBuffer);

  console.log(`[Storage] Screenshot saved to ${filepath}`);
  return filepath;
}

/**
 * Deletes all screenshots for a given issue
 */
export async function deleteScreenshotsForIssue(issueId: string): Promise<number> {
  await ensureDirectories();

  const files = await fs.readdir(SCREENSHOTS_DIR);
  const issueScreenshots = files.filter(
    (f) => f.startsWith(issueId) && (f.endsWith(".webp") || f.endsWith(".png"))
  );

  let deletedCount = 0;
  for (const file of issueScreenshots) {
    try {
      await fs.unlink(path.join(SCREENSHOTS_DIR, file));
      deletedCount++;
    } catch (err) {
      console.warn(`[Storage] Failed to delete screenshot ${file}:`, err);
    }
  }

  if (deletedCount > 0) {
    console.log(`[Storage] Deleted ${deletedCount} screenshots for issue ${issueId}`);
  }

  return deletedCount;
}
