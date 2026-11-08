const fs = require('fs')
const main = fs.readFileSync('src/components/Main.tsx', 'utf8')
for (const route of ['path="/start"', 'path="/v2/*"', 'NextGenV2Foundation']) {
  if (!main.includes(route)) { console.error('Missing NextGen entry route: ' + route); process.exit(1) }
}
console.log('PASS: NextGen 2.0 entry routes are present')
