/**
 * Ensures frontend LANGUAGES and backend SUPPORTED_DOCUMENT_LANGUAGES stay aligned.
 * Run from repository root: node scripts/check-language-codes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function extractArrayBody(text, exportName) {
  const re = new RegExp(
    `export const ${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s*const`,
    "m"
  );
  const m = text.match(re);
  return m ? m[1] : null;
}

function languageCodesInArrayBlock(block) {
  const codes = new Set();
  if (!block) {
    return codes;
  }
  const re = /value:\s*['"]([a-z]{2})['"]/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    codes.add(m[1]);
  }
  return codes;
}

function stringCodesInArrayBlock(block) {
  const codes = new Set();
  if (!block) {
    return codes;
  }
  const re = /"([a-z]{2})"/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    codes.add(m[1]);
  }
  return codes;
}

const fePath = path.join(root, "src", "app", "utils", "languages.ts");
const bePath = path.join(root, "backend", "src", "shared", "document-languages.ts");

const feText = fs.readFileSync(fePath, "utf8");
const beText = fs.readFileSync(bePath, "utf8");

const feBlock = extractArrayBody(feText, "LANGUAGES");
const beBlock = extractArrayBody(beText, "SUPPORTED_DOCUMENT_LANGUAGES");

if (!feBlock) {
  console.error("Could not parse LANGUAGES array in", fePath);
  process.exit(1);
}
if (!beBlock) {
  console.error("Could not parse SUPPORTED_DOCUMENT_LANGUAGES array in", bePath);
  process.exit(1);
}

const fe = languageCodesInArrayBlock(feBlock);
const be = stringCodesInArrayBlock(beBlock);

const onlyFe = [...fe].filter((c) => !be.has(c)).sort();
const onlyBe = [...be].filter((c) => !fe.has(c)).sort();

if (onlyFe.length > 0 || onlyBe.length > 0) {
  console.error("Language code mismatch between languages.ts and document-languages.ts");
  if (onlyFe.length > 0) {
    console.error("Only in frontend (languages.ts):", onlyFe.join(", "));
  }
  if (onlyBe.length > 0) {
    console.error("Only in backend (document-languages.ts):", onlyBe.join(", "));
  }
  process.exit(1);
}

console.log("Language codes match:", fe.size, "codes");
