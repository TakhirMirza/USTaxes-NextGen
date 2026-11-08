import fs from 'node:fs';import path from 'node:path';
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(p,x.name)):[path.join(p,x.name)]);
const files=walk('src');const bad=files.filter(p=>/\/(core|forms|data|legacy)\//.test(p)||/\b(redux|redux-persist|react-scripts|craco|tauri)\b/.test(fs.readFileSync(p,'utf8')));
if(bad.length){console.error('Legacy references:',bad);process.exit(1)}
if(!fs.existsSync('src/components/NextGenV2Foundation.tsx'))process.exit(1);
console.log('PASS: independent NextGen 2.0 source boundary; files:',files.length);
