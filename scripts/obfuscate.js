// obfuscate.js (SAFE + FAST + ANGULAR COMPATIBLE)

const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const outDir = path.resolve(__dirname, "..", "www");
const skipDirs = new Set(["assets", "svg"]);

const options = {
  compact: true,

  // SAFE for Angular
  controlFlowFlattening: false,
  deadCodeInjection: false,

  numbersToExpressions: true,
  simplify: true,

  // STRONG + FAST string obfuscation
  stringArray: true,
  stringArrayThreshold: 0.15,
  stringArrayEncoding: ["base64"],   // <-- SAFE, FAST, HIGH SECURITY

  splitStrings: true,
  splitStringsChunkLength: 8,

  shuffleStringArray: true,
  rotateStringArray: false,
  stringArrayWrappersCount: 0,

  renameGlobals: false,
  unicodeEscapeSequence: false,
  disableConsoleOutput: true,
  identifierNamesGenerator: "hexadecimal",
  target: "browser"
};

function walk(dir) {
  const list = [];
  if (!fs.existsSync(dir)) return list;

  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!skipDirs.has(e.name)) list.push(...walk(path.join(dir, e.name)));
      continue;
    }

    if (e.isFile() && e.name.endsWith(".js") && !e.name.endsWith(".map")) {
      const filePath = path.join(dir, e.name);
      const base = e.name.toLowerCase();

      const skip =
        base.includes("runtime") ||
        base.includes("polyfills") ||
        base.includes("vendor") ||
        base.includes("zone") ||
        base.includes("capacitor") ||
        base.includes("cordova") ||
        base.includes("framework") ||
        base.includes("es5") ||
        base.includes("environment") ||   // <-- MUST SKIP ENVIRONMENT
        base.includes("env");             // <-- MUST SKIP ENV

      if (!skip) list.push(filePath);
    }
  }
  return list;
}

function obfuscateFile(file) {
  try {
    const code = fs.readFileSync(file, "utf8");
    const result = JavaScriptObfuscator.obfuscate(code, options);
    fs.writeFileSync(file, result.getObfuscatedCode(), "utf8");
    console.log("Obfuscated:", path.basename(file));
  } catch (e) {
    console.error("Failed:", file, e);
  }
}

function main() {
  if (!fs.existsSync(outDir)) {
    console.error("Output directory not found:", outDir);
    return;
  }

  const files = walk(outDir);
  console.log("Total JS files to obfuscate:", files.length);

  files.forEach(obfuscateFile);

  console.log("Obfuscation completed.");
}

main();