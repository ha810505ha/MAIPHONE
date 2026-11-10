import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
const contactsSurfaceSource = await readFile(
  new URL("../components/apps/MaliPhoneFeatureSurfaces.jsx", import.meta.url),
  "utf8",
);

assert.match(
  appSource,
  /<MaliPhoneContactsSurface\s+core=\{\{\s*t,\s*tr,/,
  "the contacts surface must receive the translation function used by ContactsApp",
);
assert.match(
  contactsSurfaceSource,
  /<ContactsApp[\s\S]*?\btr=\{tr\}/,
  "the contacts surface must forward the translation function to ContactsApp",
);

console.log("ok: contacts always receives its translation function");
