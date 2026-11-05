#!/usr/bin/env node
/** Offline-safe, reproducible dependency/build preflight. Does not mutate project. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'),'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'),'utf8'));
const expected = ['react','react-dom','react-scripts','typescript','@craco/craco','@types/node'];
const dependencies = expected.map(name => ({name,declared:!!(pkg.dependencies?.[name]||pkg.devDependencies?.[name]),locked:!!(lock.packages?.[`node_modules/${name}`]||lock.dependencies?.[name]),installed:fs.existsSync(path.join(root,'node_modules',name,'package.json'))}));
const commands = ['node','npm','tsc'].map(command=>{
 try { return {command,version:cp.execFileSync(command,['--version'],{encoding:'utf8',timeout:5000}).trim()}; }
 catch (error) { return {command,error:String(error.message)}; }
});
const report={stage:74,project:pkg.name,lockfileVersion:lock.lockfileVersion,nodeModulesPresent:fs.existsSync(path.join(root,'node_modules')),dependencies,commands,reactBuildAttempted:false,reactBuildPassed:false,filingReady:false,notes:['A successful preflight does not prove that a React build passes.','Run npm ci and npm run build in a network-enabled environment.','Tax calculations remain NOT approved for filing.']};
if(process.argv.includes('--json')) process.stdout.write(JSON.stringify(report,null,2)+'\n');
else {
 console.log('USTaxes NextGen Stage 74 — build preflight');
 for(const item of dependencies) console.log(`${item.name}: declared=${item.declared} lock=${item.locked} installed=${item.installed}`);
 console.log(`node_modules present: ${report.nodeModulesPresent}; React build NOT verified`);
}
if(process.argv.includes('--strict') && dependencies.some(item=>!item.declared||!item.locked||!item.installed)) process.exitCode=1;
