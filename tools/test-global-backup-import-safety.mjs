import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importHookSource = await readFile(
  new URL("../hooks/data/useDataImportExport.js", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  importHookSource,
  /MAX_IMPORT_BYTES|file\.size\s*>/,
  "global backups must not be rejected by a client-side file-size cap",
);
assert.match(
  importHookSource,
  /JSON\.parse\(await file\.text\(\)\)/,
  "global backup import must still parse the selected file",
);
assert.match(
  importHookSource,
  /validateImportedState\?\.\(raw\)/,
  "global backup import must still validate parsed backup data",
);

console.log("ok: global backup import accepts exported files regardless of size");
