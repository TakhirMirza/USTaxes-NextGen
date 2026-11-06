#!/usr/bin/env node
/** Convert ESLint JSON into a compact CI diagnostic; never changes filing authorization. */
const fs = require('node:fs');
const path = require('node:path');
const input = process.argv[2] || 'test-results/eslint.json';
const output = process.argv[3] || 'test-results/eslint-summary.json';
if (!fs.existsSync(input)) {
  console.error(`ESLint report missing: ${input}`);
  process.exitCode = 1;
} else {
  try {
    const files = JSON.parse(fs.readFileSync(input, 'utf8'));
    if (!Array.isArray(files)) throw new TypeError('ESLint JSON must be an array');
    const entries = files.filter(f => (f.warningCount || 0) + (f.errorCount || 0) > 0)
      .map(f => ({ file: path.relative(process.cwd(), f.filePath), errors: f.errorCount || 0,
        warnings: f.warningCount || 0, rules: [...new Set((f.messages || []).map(m => m.ruleId).filter(Boolean))] }))
      .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || a.file.localeCompare(b.file));
    const summary = { errors: entries.reduce((n, f) => n + f.errors, 0),
      warnings: entries.reduce((n, f) => n + f.warnings, 0), files: entries };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
    console.log(`Stage 98 ESLint inventory: ${summary.errors} errors, ${summary.warnings} warnings across ${entries.length} files`);
    for (const f of entries) console.log(`  ${f.file}: ${f.errors} errors, ${f.warnings} warnings (${f.rules.join(', ')})`);
  } catch (error) {
    console.error(`Invalid ESLint JSON: ${error.message}`);
    process.exitCode = 1;
  }
}
