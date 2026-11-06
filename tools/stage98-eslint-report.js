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
    const ruleTotals = new Map();
    for (const f of files) {
      for (const message of f.messages || []) {
        if (message.severity !== 1 && message.severity !== 2) continue;
        const rule = message.ruleId || '(parser)';
        const previous = ruleTotals.get(rule) || { rule, errors: 0, warnings: 0 };
        if (message.severity === 2) previous.errors++;
        else previous.warnings++;
        ruleTotals.set(rule, previous);
      }
    }
    const rules = [...ruleTotals.values()].sort((a, b) =>
      b.errors - a.errors || b.warnings - a.warnings || a.rule.localeCompare(b.rule));
    const summary = { errors: entries.reduce((n, f) => n + f.errors, 0),
      warnings: entries.reduce((n, f) => n + f.warnings, 0), rules, files: entries };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
    console.log(`Stage 98 ESLint inventory: ${summary.errors} errors, ${summary.warnings} warnings across ${entries.length} files`);
    for (const f of entries) console.log(`  ${f.file}: ${f.errors} errors, ${f.warnings} warnings (${f.rules.join(', ')})`);
    const markdown = [
      '## Stage 99 ESLint diagnostic',
      '',
      `**${summary.errors} errors, ${summary.warnings} warnings** in ${entries.length} files.`,
      '',
      '| Rule | Errors | Warnings |',
      '| --- | ---: | ---: |',
      ...rules.map(r => `| \`${r.rule.replace(/\|/g, '\\|')}\` | ${r.errors} | ${r.warnings} |`),
      '',
      '| File | Errors | Warnings |',
      '| --- | ---: | ---: |',
      ...entries.map(f => `| \`${f.file.replace(/\|/g, '\\|')}\` | ${f.errors} | ${f.warnings} |`),
      '',
      'CI=false remains in effect for React build. This diagnostic does not authorize tax filing.',
      '',
    ].join('\n');
    const markdownPath = output.replace(/\.json$/i, '.md');
    fs.writeFileSync(markdownPath, markdown);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
  } catch (error) {
    console.error(`Invalid ESLint JSON: ${error.message}`);
    process.exitCode = 1;
  }
}
