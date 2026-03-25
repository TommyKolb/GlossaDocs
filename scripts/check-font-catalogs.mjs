/**
 * Ensures frontend and backend document font family sets stay aligned.
 * Run from repository root: node scripts/check-font-catalogs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function extractFamilyNames(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const set = new Set();
  const re = /family:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    set.add(m[1]);
  }
  return set;
}

const frontendPath = path.join(root, "src", "app", "utils", "language-fonts.ts");
const backendPath = path.join(root, "backend", "src", "shared", "document-fonts.ts");

const fe = extractFamilyNames(frontendPath);
const be = extractFamilyNames(backendPath);

const onlyFe = [...fe].filter((f) => !be.has(f)).sort();
const onlyBe = [...be].filter((f) => !fe.has(f)).sort();

if (onlyFe.length > 0 || onlyBe.length > 0) {
  console.error("Font family mismatch between language-fonts.ts and document-fonts.ts");
  if (onlyFe.length > 0) {
    console.error("Only in frontend:", onlyFe.join(", "));
  }
  if (onlyBe.length > 0) {
    console.error("Only in backend:", onlyBe.join(", "));
  }
  process.exit(1);
}

console.log("Font catalogs match:", fe.size, "families");
