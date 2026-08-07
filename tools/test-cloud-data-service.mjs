import assert from "node:assert/strict";
import {
  CloudDataUnavailableError,
  getCloudDataConfig,
  runCloudDatabaseConnectionTest,
} from "../services/cloud/cloudDataService.js";

assert.deepEqual(getCloudDataConfig({}), { url: "", configured: false });
assert.deepEqual(
  getCloudDataConfig({ VITE_CLOUDFLARE_DATA_API_URL: "https://worker.example/" }),
  { url: "https://worker.example", configured: true },
);
await assert.rejects(runCloudDatabaseConnectionTest(null, {}), CloudDataUnavailableError);

const originalFetch = globalThis.fetch;
try {
  let call = 0;
  let testedAt = "";
  globalThis.fetch = async (input, init) => {
    call += 1;
    assert.equal(String(input), "https://worker.example/v1/documents/d1-connection-test");
    assert.equal(init.headers.Authorization, "Bearer test-access-token");
    if (call === 1) {
      assert.equal(init.method, "PUT");
      testedAt = JSON.parse(init.body).testedAt;
      return Response.json({ key: "d1-connection-test", revision: 1 });
    }
    assert.equal(init.method, "GET");
    return Response.json({ key: "d1-connection-test", data: { message: "MaliPhone D1 connection test", testedAt } });
  };
  const document = await runCloudDatabaseConnectionTest(
    { access_token: "test-access-token" },
    { VITE_CLOUDFLARE_DATA_API_URL: "https://worker.example" },
  );
  assert.equal(document.data.testedAt, testedAt);
  assert.equal(call, 2);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("ok: cloud database test requires an authenticated user and verifies a private D1 document");
