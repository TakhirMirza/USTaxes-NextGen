#!/usr/bin/env node
/** Fail closed if the ESLint inventory disappears or exceeds the Stage 98 baseline. */
const fs = require('node:fs');
const path = require('node:path');
const report = process.argv[2] || 'test-results/eslint-summary.json';
const maxErrors = 10;
const maxWarnings = 70;
try {
  const summary = JSON.parse(fs.readFileSync(report, 'utf8'));
  if (!Number.isInteger(summary.errors) || !Number.isInteger(summary.warnings) ||
      summary.errors < 0 || summary.warnings < 0 || !Array.isArray(summary.files) ||
      !Array.isArray(summary.rules)) throw new Error('Invalid ESLint summary structure');
  const fileErrors = summary.files.reduce((sum, item) => sum + item.errors, 0);
  const fileWarnings = summary.files.reduce((sum, item) => sum + item.warnings, 0);
  if (fileErrors !== summary.errors || fileWarnings !== summary.warnings)
    throw new Error('ESLint summary totals do not match file totals');
  console.log(`Stage 103 ESLint budget: ${summary.errors}/${maxErrors} errors, ${summary.warnings}/${maxWarnings} warnings`);
  if (summary.errors > maxErrors || summary.warnings > maxWarnings)
    throw new Error('ESLint findings exceed Stage 98 baseline; fix new findings before merging');
  console.log('PASS Stage 103 ESLint non-regression budget (not a lint-clean certification)');
} catch (error) {
  console.error(`FAIL Stage 103 ESLint budget: ${error.message}`);
  process.exitCode = 1;
}
