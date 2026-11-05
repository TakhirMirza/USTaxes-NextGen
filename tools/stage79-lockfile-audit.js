#!/usr/bin/env node
/** Dependency-free npm lockfile integrity and direct-dependency preflight. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function audit(pkg, lock) {
  const issues = [];
  const warnings = [];
  if (!lock || ![2,3].includes(lock.lockfileVersion) || !lock.packages || !lock.packages[''])
    return {ok:false,issues:['Unsupported or incomplete npm lockfile']};
  const root = lock.packages[''];
  for (const group of ['dependencies','devDependencies','optionalDependencies']) {
    const declared = pkg[group] || {};
    const locked = root[group] || {};
    for (const [name,range] of Object.entries(declared)) {
      if (locked[name] !== range) issues.push(`${group}: ${name} package.json/lockfile root mismatch`);
      const entry = lock.packages[`node_modules/${name}`];
      if (!entry || !entry.version) issues.push(`${group}: ${name} missing resolved lockfile package`);
      else if (!entry.link && !entry.integrity && !entry.resolved?.startsWith('file:'))
        warnings.push(`${group}: ${name} lacks integrity metadata in legacy lockfile`);
    }
    for (const name of Object.keys(locked))
      if (!(name in declared)) issues.push(`${group}: ${name} exists only in lockfile root`);
  }
  if (pkg.name !== lock.name) issues.push('Package name mismatch');
  if (pkg.version !== lock.version) issues.push('Package version mismatch');
  return {ok:issues.length===0,issues,warnings,directPackages:Object.values(pkg.dependencies||{}).length + Object.values(pkg.devDependencies||{}).length};
}
if (require.main === module) {
  const root = path.resolve(__dirname,'..');
  const result = audit(JSON.parse(fs.readFileSync(path.join(root,'package.json'))), JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'))));
  console.log(JSON.stringify(result,null,2));
  if (!result.ok) process.exitCode=1;
}
module.exports = {audit};
