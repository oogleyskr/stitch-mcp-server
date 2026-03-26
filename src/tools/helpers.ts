/**
 * Shared helper utilities used across multiple tool modules.
 *
 * Centralises regex-based HTML extraction so every tool module
 * uses the same implementation and return types.
 */

/**
 * Returns an array of unique strings that match `pattern` in `html`.
 *
 * @param html    - The HTML string to search.
 * @param pattern - A global RegExp to match against.
 * @returns De-duplicated array of matched strings.
 */
export function extractUnique(html: string, pattern: RegExp): readonly string[] {
  return [...new Set(html.match(pattern) ?? [])];
}

/**
 * Extracts CSS property values from inline style attributes within HTML.
 *
 * @param html     - The HTML string to search.
 * @param property - A CSS property name (or regex fragment) to match.
 * @returns De-duplicated array of the property values found.
 */
export function extractCssValues(html: string, property: string): readonly string[] {
  const regex = new RegExp(`${property}:\\s*([^;]+)`, "gi");
  const matches = html.match(regex) ?? [];
  return [...new Set(
    matches
      .map((m) => m.split(":").slice(1).join(":").trim())
      .filter(Boolean),
  )];
}

/**
 * Validates that a value is a non-empty string.
 *
 * @param value - The value to check.
 * @param name  - Human-readable name for error messages.
 * @throws {Error} When the value is missing or empty.
 */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required and must be a non-empty string.`);
  }
  return value.trim();
}

/**
 * Validates that a value is a non-empty array.
 *
 * @param value - The value to check.
 * @param name  - Human-readable name for error messages.
 * @throws {Error} When the value is not an array or is empty.
 */
export function requireNonEmptyArray<T>(value: unknown, name: string): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array.`);
  }
  return value as T[];
}
