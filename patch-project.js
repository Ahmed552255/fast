const fs = require('fs');
const path = require('path');

const analyzePath = path.resolve('e:/fast/src/pages/api/analyze.js');
let text = fs.readFileSync(analyzePath, 'utf8');
if (text.includes('const responseText = result.response.text();')) {
  text = text.replace('const responseText = result.response.text();', 'const responseText = result.text ?? "";');
  fs.writeFileSync(analyzePath, text, 'utf8');
  console.log('patched analyze.js responseText');
} else {
  console.log('responseText line not found');
}

const pkgPath = path.resolve('e:/fast/package.json');
let pkg = fs.readFileSync(pkgPath, 'utf8');
if (!pkg.includes('@upstash/redis')) {
  pkg = pkg.replace(
    '    "@google/genai": "latest",\n    "astro": "latest"\n',
    '    "@google/genai": "latest",\n    "@upstash/redis": "^1.34.3",\n    "astro": "latest",\n    "firebase-admin": "^12.13.1"\n'
  );
  fs.writeFileSync(pkgPath, pkg, 'utf8');
  console.log('patched package.json');
} else {
  console.log('package.json already contains @upstash/redis');
}
