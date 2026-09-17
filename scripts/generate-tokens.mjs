// Emits src/app/ui/tokens.generated.ts from the SCSS token map (ADR 0007).
// Run via `pnpm run tokens:generate`. Never hand-edit the output.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/styles/tokens/_tokens.scss');
const target = resolve(root, 'src/app/ui/tokens.generated.ts');

const scss = readFileSync(source, 'utf8');
const tokens = parseTokenMap(stripComments(scss));

if (tokens.length === 0) {
  throw new Error(`No tokens found in ${source}`);
}

const body = tokens
  .map(([name, value]) => `  '${name}': '${value.replaceAll("'", "\\'")}',`)
  .join('\n');

writeFileSync(
  target,
  `/**
 * Generated from \`src/styles/tokens/_tokens.scss\` by \`scripts/generate-tokens.mjs\`.
 * Committed, never hand-edited (ADR 0007). Consumed only by \`DesignTokenService\`,
 * which applies each entry as a \`--\`-prefixed CSS custom property at bootstrap.
 */
export const DESIGN_TOKENS = {
${body}
} as const;

export type DesignTokenName = keyof typeof DESIGN_TOKENS;
`,
  'utf8',
);

console.log(`Wrote ${tokens.length} tokens to ${target}`);

function stripComments(text) {
  return text.replaceAll(/^\s*\/\/.*$/gm, '');
}

function parseTokenMap(text) {
  const start = text.indexOf('$tokens:');
  if (start === -1) {
    throw new Error('Could not find the `$tokens` map');
  }
  const open = text.indexOf('(', start);
  const close = matchingParen(text, open);
  return splitTopLevel(text.slice(open + 1, close)).map(toEntry);
}

function matchingParen(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === '(') depth++;
    if (text[index] === ')') {
      depth--;
      if (depth === 0) return index;
    }
  }
  throw new Error('Unbalanced parentheses in the `$tokens` map');
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const character of text) {
    if (character === '(') depth++;
    if (character === ')') depth--;
    if (character === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function toEntry(entry) {
  const separator = entry.indexOf(':');
  if (separator === -1) {
    throw new Error(`Malformed token entry: ${entry}`);
  }
  const name = entry
    .slice(0, separator)
    .trim()
    .replaceAll(/^['"]|['"]$/g, '');
  let value = entry
    .slice(separator + 1)
    .trim()
    .replaceAll(/\s+/g, ' ');

  // A parenthesised SCSS list (e.g. a font stack) becomes a bare comma-separated
  // CSS value; `rgba(...)`-style function calls are left intact.
  if (value.startsWith('(') && matchingParen(value, 0) === value.length - 1) {
    value = value.slice(1, -1).trim().replace(/,\s*$/, '');
  }
  return [name, value];
}
