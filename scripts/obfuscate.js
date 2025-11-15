// obfuscate.js
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const outDir = path.resolve(__dirname, '..', 'www');
const skipDirs = new Set(['assets', 'svg']);

// SAFE options: strong string protection but minimal runtime transformations
const options = {
  compact: true,
  // Do NOT enable controlFlowFlattening or deadCodeInjection for Angular apps (they break runtime)
  controlFlowFlattening: false,
  controlFlowFlatteningThreshold: 0.0,
  deadCodeInjection: false,
  deadCodeInjectionThreshold: 0.0,

  // strong but safe transforms
  numbersToExpressions: true,
  simplify: true,

  // string protection - good balance for performance
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 1.0,
  splitStrings: true,
  splitStringsChunkLength: 8,
  shuffleStringArray: true,
  rotateStringArray: true,

  // wrappers help reduce runtime overhead compared to per-string decryption
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,

  // misc safe options
  disableConsoleOutput: true,
  renameGlobals: false,
  identifierNamesGenerator: 'hexadecimal',
  unicodeEscapeSequence: false,
  target: 'browser'
};

function walk(dir) {
  const list = [];
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (skipDirs.has(e.name)) continue;
      list.push(...walk(path.join(dir, e.name)));
    } else if (e.isFile() && e.name.endsWith('.js') && !e.name.endsWith('.map')) {
      const filePath = path.join(dir, e.name);
      const base = e.name.toLowerCase();

      // Skip known framework/runtime/vendor bundles and plugin bridges.
      // We WILL obfuscate 'main.*.js' and chunk files, but skip core vendor/runtime/polyfills/zone files.
      const isSkippedBundle =
        base.includes('runtime') ||
        base.includes('polyfills') ||
        base.includes('vendor') ||
        base.includes('zone') ||
        base.includes('framework') ||
        base.includes('cordova') ||
        base.includes('capacitor') ||
        base.includes('cordova-') ||
        base.includes('main-es5') || // older builds
        base.includes('es5') ;

      if (!isSkippedBundle) list.push(filePath);
    }
  }
  return list;
}

function obfuscateFile(file) {
  try {
    const code = fs.readFileSync(file, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, options);
    fs.writeFileSync(file, result.getObfuscatedCode(), 'utf8');
    console.log('Obfuscated:', file);
  } catch (e) {
    console.error('Failed to obfuscate', file, e);
  }
}

function main() {
  if (!fs.existsSync(outDir)) {
    console.error('Output directory not found:', outDir);
    process.exit(0);
  }
  const files = walk(outDir);
  console.log('Files to obfuscate:', files.length);
  for (const f of files) {
    obfuscateFile(f);
  }
  console.log('Obfuscation complete.');
}

main();