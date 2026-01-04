#!/usr/bin/env node

/**
 * Fix imports script for CLI package
 * This script post-processes compiled JavaScript files to add .js extensions
 * to relative imports, which is required for ESM modules.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, '../dist');

/**
 * Recursively process all .js files in a directory
 */
async function processDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      await fixImportsInFile(fullPath);
    }
  }
}

/**
 * Fix import statements in a single file
 */
async function fixImportsInFile(filePath) {
  let content = await readFile(filePath, 'utf-8');

  // Fix relative imports that don't have .js extension
  // Pattern: from './something' or from '../something' without .js
  const importPattern = /from ['"]((\.\.\/|\.\/)[^'"]+)['"]/g;

  let modified = false;
  content = content.replace(importPattern, (match, importPath) => {
    // Don't add .js if it already has an extension
    if (importPath.endsWith('.js') || importPath.startsWith('node:')) {
      return match;
    }

    // Add .js extension
    modified = true;
    return match.replace(importPath, `${importPath}.js`);
  });

  if (modified) {
    await writeFile(filePath, content, 'utf-8');
    console.log(`✓ Fixed imports in ${filePath}`);
  }
}

// Run the fix
console.log('Fixing ESM imports in compiled files...');
await processDirectory(distDir);
console.log('✓ ESM import fixing completed');
