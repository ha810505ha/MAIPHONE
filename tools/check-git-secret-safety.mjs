import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  encoding: "buffer",
}).toString("utf8").split("\0").filter(Boolean);

const unsafeFileName = (file) => {
  const name = file.split("/").pop() || "";
  return (
    (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) ||
    name === "wrangler.toml" ||
    name === "google-services.json" ||
    name === "GoogleService-Info.plist" ||
    name === "local.properties" ||
    /(?:^|\/)(?:service-account[^/]*|credentials[^/]*)\.json$/i.test(file) ||
    /\.(?:pem|key|p12|pfx|jks|keystore|mobileprovision|apk|aab|ipa|tfvars)$/i.test(file)
  );
};

const credentialValue = /(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,})/;
const violations = [];

for (const file of files) {
  if (unsafeFileName(file)) {
    violations.push(`${file} (sensitive filename)`);
    continue;
  }
  try {
    if (statSync(file).size > 2 * 1024 * 1024) continue;
    const content = readFileSync(file, "utf8");
    if (!content.includes("\0") && credentialValue.test(content)) violations.push(`${file} (credential-shaped value)`);
  } catch {
    // Files that disappear during a local edit are ignored; the next check will inspect them again.
  }
}

if (violations.length) {
  console.error("Refusing to publish files that may contain credentials:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`ok: ${files.length} publishable files passed the credential safety check`);
}
