import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  CloudMediaError,
  CLOUD_MEDIA_MAX_BYTES,
  createCloudMediaName,
  downloadCloudMedia,
  downloadTextSyncMedia,
  uploadCloudMedia,
  uploadTextSyncMedia,
} from "../services/cloud/cloudMediaService.js";
import {
  collectTextSyncMedia,
  createTextSyncDocument,
  hydrateTextSyncMedia,
  preserveLocalMedia,
  stripTextSyncMedia,
} from "../utils/textSyncDocument.js";
import { CLOUD_MEDIA_PREFIX, getCloudMediaName } from "../utils/cloudMediaRefs.js";
import { runDataRestoreTransaction } from "../services/backup/dataRestoreTransaction.js";
import { compressImageForGallery } from "../services/images/galleryImageStorage.js";
import { CLOUD_MEDIA_SYNC_TEXT, cloudMediaSyncSummary } from "../constants/cloudMediaSyncText.js";
import { SUPPORTED_UI_LANGUAGES, translate } from "../utils/i18n.js";
import { mergeWalletSyncData } from "../utils/walletSync.js";
import { mergeGameProgressSyncData } from "../utils/gameProgressSync.js";

const session = { access_token: "mock-media-session" };
const environment = { VITE_CLOUDFLARE_DATA_API_URL: "https://media.example/" };
const imageA = "data:image/png;base64,YQ==";
const imageB = "data:image/png;base64,Yg==";
const imageC = "data:image/png;base64,Yw==";
const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
const hash = createHash("sha256").update(new Uint8Array([1, 2, 3, 4])).digest("hex");
const name = `sha256-${hash}.png`;
const ref = `${CLOUD_MEDIA_PREFIX}${name}`;
const refB = `${CLOUD_MEDIA_PREFIX}sha256-${"b".repeat(64)}.webp`;
const refC = `${CLOUD_MEDIA_PREFIX}sha256-${"c".repeat(64)}.jpg`;
const originalFetch = globalThis.fetch;
let checks = 0;
async function test(label, work) {
  await work();
  checks += 1;
  console.log(`ok ${checks}: ${label}`);
}
function mockFetch(handler) {
  globalThis.fetch = (url, init) => {
    assert.ok(init.signal instanceof AbortSignal, "media requests must carry a deadline");
    assert.equal(init.headers.Authorization, `Bearer ${session.access_token}`);
    assert.match(String(url), /^https:\/\/media\.example\/v1\/media\/sha256-[0-9a-f]{64}\.(png|webp|jpg)$/);
    return handler(url, init);
  };
}

try {
  await test("names hash the actual bytes and use supported lowercase extensions", async () => {
    assert.equal(await createCloudMediaName(blob), name);
    for (const [type, ext] of [["image/png", "png"], ["image/webp", "webp"], ["image/jpeg", "jpg"]]) {
      assert.equal(await createCloudMediaName(new Blob([await blob.arrayBuffer()], { type })), `sha256-${hash}.${ext}`);
    }
    await assert.rejects(createCloudMediaName(new Blob(["gif"], { type: "image/gif" })), (error) => error.status === 415);
    assert.equal(getCloudMediaName(`${CLOUD_MEDIA_PREFIX}../anything.png`), null);
    assert.equal(getCloudMediaName(ref.toUpperCase()), null);
  });

  await test("HEAD 200 skips PUT; HEAD 404 and legacy 405 upload the exact blob", async () => {
    for (const headStatus of [200, 404, 405]) {
      const methods = [];
      mockFetch(async (_url, init) => {
        methods.push(init.method);
        if (init.method === "HEAD") return new Response(null, { status: headStatus });
        assert.equal(init.headers["Content-Type"], "image/png");
        assert.deepEqual(new Uint8Array(await init.body.arrayBuffer()), new Uint8Array(await blob.arrayBuffer()));
        return Response.json({ key: name, etag: "mock-etag" }, { status: 201 });
      });
      assert.deepEqual(await uploadCloudMedia(session, blob, environment), { ref, uploaded: headStatus !== 200 });
      assert.deepEqual(methods, headStatus === 200 ? ["HEAD"] : ["HEAD", "PUT"]);
    }
  });

  await test("HTTP failures retain their status and reject invalid or oversized images", async () => {
    for (const status of [401, 413, 415, 507]) {
      mockFetch(async (_url, init) => init.method === "HEAD"
        ? new Response(null, { status: 404 })
        : Response.json({ error: "mock server error" }, { status }));
      await assert.rejects(uploadCloudMedia(session, blob, environment), (error) => error instanceof CloudMediaError && error.status === status);
    }
    await assert.rejects(uploadCloudMedia(session, new Blob([new Uint8Array(CLOUD_MEDIA_MAX_BYTES + 1)], { type: "image/png" }), environment), (error) => error.status === 413);
    let calls = 0;
    globalThis.fetch = () => { calls += 1; throw new Error("unexpected fetch"); };
    await assert.rejects(uploadCloudMedia(null, blob, environment), (error) => error.status === 401);
    assert.equal(calls, 0, "unauthenticated media must never be sent");
  });

  await test("collection selects only first-batch fields, deduplicates, and excludes local-only stores", () => {
    const source = {
      characters: [{ id: "one", avatar: imageA, avatarOriginal: imageA, heroImage: imageB, cover: imageB, banner: imageB }],
      chatBackgrounds: { one: imageB },
      settings: { "wall-paper": imageC, avatarUrl: "https://example/avatar.png" },
      chatHistory: { one: [{ image: imageC }] },
      background: { custom: imageB, cover: imageC },
      featureData: { gallery: [{ avatar: imageC }], notes: [{ background: imageA }] },
      localAppData: { avatar: imageC },
    };
    assert.deepEqual([...collectTextSyncMedia(source)], [[imageA, "avatar"], [imageB, "background"], [imageC, "background"]]);
    assert.deepEqual([...collectTextSyncMedia({ wallpaper: imageA, profile: { avatar: imageA } })], [[imageA, "avatar"]]);
    assert.equal(collectTextSyncMedia({ cover: { avatar: imageA }, featureData: { gallery: { avatar: imageA } }, localAppData: { background: imageB } }).size, 0);
  });

  await test("documents without mediaRefs equal legacy output; supplied refs affect first-batch fields only", () => {
    const source = { characters: [{ id: "one", name: "Text", avatar: imageA, cover: imageA, banner: imageB }], chatBackgrounds: { one: imageB }, featureData: {}, localAppData: { avatar: imageA } };
    const without = createTextSyncDocument(source, { version: "test" });
    const { exportedAt, ...stableDocument } = without;
    assert.ok(Number.isFinite(Date.parse(exportedAt)));
    assert.deepEqual(stableDocument, {
      format: "maliphone-text-sync", formatVersion: 1, version: "test",
      state: {
        characters: [{ id: "one", name: "Text" }],
        featureData: { notes: [], calendar: null, loginReward: null, yunyinSave: null, systemMailbox: null, gachaCurrency: 0, gachaCrystalLedger: [] },
        walletData: { wallet: { balance: 0, transactions: [], assets: [] }, characterWallets: {}, transfers: [] },
      },
    }, "golden document matches the pre-media version, including its v1 envelope");
    assert.equal("avatar" in without.state.characters[0], false);
    assert.equal("chatBackgrounds" in without.state, false);
    const withRefs = createTextSyncDocument(source, { version: "test", mediaRefs: new Map([[imageA, ref], [imageB, refB]]) });
    assert.equal(withRefs.formatVersion, 1);
    assert.equal(withRefs.state.characters[0].avatar, ref);
    assert.deepEqual(withRefs.state.chatBackgrounds, { one: refB });
    assert.equal("cover" in withRefs.state.characters[0], false);
    assert.equal("banner" in withRefs.state.characters[0], false);
    assert.equal("localAppData" in withRefs.state, false);
    assert.doesNotMatch(JSON.stringify(withRefs), /data:image/);
    const empty = createTextSyncDocument(source, { mediaRefs: new Map() });
    assert.deepEqual(empty.state, without.state);
  });

  await test("same data URL is compressed once with the strictest size limit", async () => {
    const compressed = [];
    mockFetch(async (_url, init) => init.method === "HEAD" ? new Response(null, { status: 404 }) : Response.json({}, { status: 201 }));
    const result = await uploadTextSyncMedia({ wallpaper: imageA, characters: [{ avatar: imageA }], background: imageB }, {
      session, environment,
      compress: async (dataUrl, options) => {
        compressed.push([dataUrl, options]);
        return { blob };
      },
    });
    assert.equal(compressed.length, 2);
    assert.equal(compressed[0][1].maxEdge, 512);
    assert.equal(compressed[1][1].maxEdge, 1280);
    assert.equal(compressed[0][1].maxBytes, 400 * 1024);
    assert.equal(result.mediaRefs.size, 2);
  });

  await test("507 stops all remaining image uploads without blocking a text document", async () => {
    const methods = [];
    let compressed = 0;
    mockFetch(async (_url, init) => {
      methods.push(init.method);
      return init.method === "HEAD" ? new Response(null, { status: 404 }) : Response.json({ error: "Media quota exceeded" }, { status: 507 });
    });
    const source = { characters: [{ id: "one", avatar: imageA, background: imageB, wallpaper: imageC, name: "Still syncs" }] };
    const result = await uploadTextSyncMedia(source, { session, environment, compress: async () => { compressed += 1; return { blob }; } });
    assert.equal(result.quotaExceeded, true);
    assert.equal(compressed, 1);
    assert.deepEqual(methods, ["HEAD", "PUT"]);
    const document = createTextSyncDocument(source, { mediaRefs: result.mediaRefs });
    assert.equal(document.state.characters[0].name, "Still syncs");
    assert.equal("avatar" in document.state.characters[0], false);
  });

  await test("individual compression, HTTP, and network failures skip only their image", async () => {
    for (const failure of ["compression", "http", "network"]) {
      let compressCalls = 0;
      let putCalls = 0;
      mockFetch(async (_url, init) => {
        if (init.method === "HEAD") return new Response(null, { status: 404 });
        putCalls += 1;
        if (putCalls === 1 && failure === "network") throw new Error("mock offline");
        if (putCalls === 1 && failure === "http") return new Response(null, { status: 413 });
        return Response.json({}, { status: 201 });
      });
      const source = { characters: [{ id: "one", avatar: imageA, name: "Text remains" }, { id: "two", avatar: imageB }] };
      const result = await uploadTextSyncMedia(source, {
        session, environment,
        compress: async () => { compressCalls += 1; if (compressCalls === 1 && failure === "compression") throw new Error("mock bad image"); return { blob }; },
      });
      assert.equal(result.failed, 1);
      assert.equal(result.mediaRefs.has(imageA), false);
      assert.equal(result.mediaRefs.get(imageB), ref);
      const document = createTextSyncDocument(source, { mediaRefs: result.mediaRefs });
      assert.equal(document.state.characters[0].name, "Text remains");
      assert.equal(document.state.characters[1].avatar, ref);
    }
  });

  await test("GET validates returned content and converts bytes into a data URL", async () => {
    mockFetch(async (_url, init) => {
      assert.equal(init.method, "GET");
      return new Response(blob);
    });
    assert.equal(await downloadCloudMedia(session, ref, environment), "data:image/png;base64,AQIDBA==");
    mockFetch(async () => new Response(new Blob(["corrupted"], { type: "image/png" })));
    await assert.rejects(downloadCloudMedia(session, ref, environment), (error) => error.status === 415);
    mockFetch(async () => new Response("not an image", { headers: { "Content-Type": "text/html" } }));
    await assert.rejects(downloadCloudMedia(session, ref, environment), (error) => error.status === 415);
  });

  await test("downloads fill empty fields and preserve local images and background-map entries", async () => {
    let gets = 0;
    mockFetch(async () => { gets += 1; return new Response(blob); });
    const local = {
      characters: [{ id: "two", avatar: imageB }, { id: "one", avatar: "" }],
      chatBackgrounds: { one: imageC, extra: imageB },
    };
    const remote = {
      characters: [{ id: "one", avatar: ref, name: "New text" }, { id: "two", avatar: ref }],
      chatBackgrounds: { one: ref, two: ref }, playerProfile: { wallpaper: ref },
    };
    const result = await downloadTextSyncMedia(remote, local, { session, environment });
    assert.equal(result.state.characters[0].avatar, "data:image/png;base64,AQIDBA==");
    assert.equal(result.state.characters[1].avatar, imageB, "match local images by ID after reordering");
    assert.equal(result.state.chatBackgrounds.one, imageC);
    assert.equal(result.state.chatBackgrounds.extra, imageB);
    assert.equal(result.state.chatBackgrounds.two, "data:image/png;base64,AQIDBA==");
    assert.equal(result.state.playerProfile.wallpaper, "data:image/png;base64,AQIDBA==");
    assert.equal(gets, 1, "the same ref downloads once per sync");
    assert.equal(result.downloaded, 1);
    assert.doesNotMatch(JSON.stringify(result.state), /maliphone-media:/);
    const newCharacter = await hydrateTextSyncMedia({ characters: [{ id: "new", avatar: ref }] }, local, async () => imageA);
    assert.equal(newCharacter.state.characters[0].avatar, imageA, "new IDs must not inherit a different character's image");
  });

  await test("existing local images never trigger GET or change", async () => {
    globalThis.fetch = () => { throw new Error("local image must skip fetch"); };
    const local = { avatar: imageA, background: "https://example/local.png", wallpaper: imageC };
    const result = await downloadTextSyncMedia({ avatar: ref, background: refB, wallpaper: refC }, local, { session, environment });
    assert.deepEqual(result.state, local);
    assert.equal(result.downloaded, 0);
    assert.equal(result.failed, 0);
  });

  await test("media containers preserve local-only array entries and mismatched local container shapes", async () => {
    const local = { background: [{ id: "extra", avatar: imageA }, { id: "one", avatar: imageB }] };
    const result = await hydrateTextSyncMedia({ background: [{ id: "one", avatar: ref }] }, local, () => { throw new Error("unexpected download"); });
    assert.deepEqual(result.state, local);
    for (const [remote, local] of [[{ background: [ref] }, { background: { one: imageA } }], [{ background: { one: ref } }, { background: [imageA] }]]) {
      const result = await hydrateTextSyncMedia(remote, local, () => { throw new Error("unexpected download"); });
      assert.deepEqual(result.state, local);
    }
  });

  await test("failed and invalid downloads stay empty, strip references, and leave text usable", async () => {
    let gets = 0;
    mockFetch(async () => { gets += 1; return new Response(null, { status: 404 }); });
    const remote = { avatar: ref, background: { one: ref }, characters: [{ id: "one", avatar: `${CLOUD_MEDIA_PREFIX}bad`, name: "Keep text" }], cover: ref, title: ref };
    const result = await downloadTextSyncMedia(remote, {}, { session, environment });
    assert.equal(result.state.avatar, undefined);
    assert.equal(result.state.background.one, undefined);
    assert.equal(result.state.characters[0].name, "Keep text");
    assert.equal(gets, 1);
    assert.equal(result.failed, 1);
    assert.doesNotMatch(JSON.stringify(result.state), /maliphone-media:/);
  });

  await test("legacy preserveLocalMedia safely discards cloud refs and keeps this device's media", () => {
    const remote = { characters: [{ id: "one", avatar: ref }, { id: "two", avatar: ref }], chatBackgrounds: { one: ref } };
    const local = { characters: [{ id: "one", avatar: imageA }], chatBackgrounds: { one: imageB } };
    const merged = preserveLocalMedia(remote, local);
    assert.equal(merged.characters[0].avatar, imageA);
    assert.equal(merged.characters[1].avatar, undefined);
    assert.deepEqual(merged.chatBackgrounds, local.chatBackgrounds);
    assert.doesNotMatch(JSON.stringify(merged), /maliphone-media:/);
  });

  await test("compression caps avatar/background dimensions and preserves alpha without changing gallery defaults", async () => {
    const originalDocument = globalThis.document;
    const originalImage = globalThis.Image;
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    const drawings = [];
    class FakeCanvas {
      constructor(width = 1, height = 1) { this.width = width; this.height = height; }
      toDataURL() { return "data:image/webp;base64,"; }
      getContext(_type, options) { return { drawImage: () => { drawings.push({ width: this.width, height: this.height, alpha: options.alpha }); } }; }
      async convertToBlob({ type }) { return new Blob([new Uint8Array(this.width > 512 ? 500 * 1024 : 20)], { type }); }
    }
    globalThis.document = { createElement: () => new FakeCanvas() };
    globalThis.OffscreenCanvas = FakeCanvas;
    globalThis.Image = class {
      naturalWidth = 3000;
      naturalHeight = 1500;
      set src(_value) { queueMicrotask(() => this.onload()); }
    };
    try {
      const avatar = await compressImageForGallery(imageA, { maxEdge: 512, preserveAlpha: true });
      assert.equal(avatar.width, 512);
      assert.equal(avatar.height, 256);
      assert.ok(avatar.bytes <= CLOUD_MEDIA_MAX_BYTES);
      assert.equal(drawings[0].alpha, true);
      drawings.length = 0;
      const background = await compressImageForGallery(imageB, { maxEdge: 1280, preserveAlpha: true });
      assert.ok(drawings.every((drawing) => drawing.width <= 1280 && drawing.height <= 1280));
      assert.ok(background.bytes <= CLOUD_MEDIA_MAX_BYTES, "compression steps down dimensions when quality alone is insufficient");
      drawings.length = 0;
      await compressImageForGallery(imageA);
      assert.equal(drawings[0].width, 1536, "existing gallery starts at its original dimension");
      assert.equal(drawings[0].alpha, false, "existing gallery alpha behavior stays unchanged");
    } finally {
      if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
      if (originalImage === undefined) delete globalThis.Image; else globalThis.Image = originalImage;
      if (originalOffscreenCanvas === undefined) delete globalThis.OffscreenCanvas; else globalThis.OffscreenCanvas = originalOffscreenCanvas;
    }
  });

  await test("new notices have all five locales and formatted upload/download summaries", () => {
    for (const translations of Object.values(CLOUD_MEDIA_SYNC_TEXT)) {
      for (const locale of SUPPORTED_UI_LANGUAGES) assert.ok(translations[locale]);
    }
    for (const locale of SUPPORTED_UI_LANGUAGES) {
      const tr = (...values) => translate(locale, ...values);
      for (const result of [{ uploaded: 2, existing: 1, failed: 1 }, { uploaded: 0, quotaExceeded: true }, { downloaded: 2, failed: 1 }]) {
        const summary = cloudMediaSyncSummary(result, tr);
        assert.ok(summary);
        assert.doesNotMatch(summary, /\{count\}/);
      }
    }
  });

  await test("snapshot upload/download integration passes auth and saves only hydrated images", async () => {
    // Load the plain JS snapshot hook with in-memory storage dependencies. No
    // browser profile, player data, IndexedDB, or credentials are accessed.
    const source = (await readFile(new URL("../hooks/data/useGlobalDataSnapshot.js", import.meta.url), "utf8"))
      .replace(/^import[\s\S]*?;\r?\n/gm, "")
      .replace("export const LOCAL_APP_DATA_KEYS", "const LOCAL_APP_DATA_KEYS")
      .replace("export default function useGlobalDataSnapshot", "function useGlobalDataSnapshot");
    const localFeatureData = { notes: [{ id: "note", avatar: "", text: "Before" }], gallery: { keep: "local only" } };
    const savedStates = [];
    const featureImports = [];
    const identity = (value) => value;
    const dependencies = {
      DOCK_APPS: [], VERSION: "test", HOME_SLOT_COUNT: 1, FONT_PRESETS: { sans: {} },
      normalizeUiLanguage: identity, preserveMissingDeviceSecrets: identity,
      sanitizeCustomCss: identity, sanitizeFontName: identity,
      compactActiveRoomMirrors: identity, compactCharacterImages: identity,
      compactGroupMessageImages: identity, compactSocialPostImages: identity,
      normalizeCharacterBlockStates: (value) => value || {},
      loadFeatureBackup: async () => localFeatureData,
      restoreFeatureBackup: async (state) => { featureImports.push(state); },
      summarizeFeatureBackup: () => ({}), saveAppState: async (state) => { savedStates.push(state); },
      capturePersonaData: () => ({}), serializePersonas: identity,
      compactActivePersona: identity, compactLegacyLocalData: identity,
      packBackupMedia: async (state) => ({ state, assets: {} }),
      restoreActivePersona: identity, unpackBackupMedia: identity,
      createTextSyncDocument, validateTextSyncDocument: (document) => document,
      uploadTextSyncMedia: (state, options) => uploadTextSyncMedia(state, { ...options, compress: async () => ({ blob }) }),
      downloadTextSyncMedia, mergeWalletSyncData, mergeGameProgressSyncData,
      // MP-040 data protection: React state, local snapshots, and the restore transaction.
      useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}],
      stripDeviceSecrets: identity, preserveLocalMedia, stripTextSyncMedia,
      SNAPSHOT_REASONS: { daily: "daily" }, getLocalSnapshot: async () => null,
      isDailySnapshotDue: async () => false, saveLocalSnapshot: async () => null,
      recordRuntimeDiagnostic() {}, summarizeBackupContent: () => ({}),
      runDataRestoreTransaction,
    };
    const useSnapshot = new Function("dependencies", `const { ${Object.keys(dependencies).join(", ")} } = dependencies;\n${source}\nreturn useGlobalDataSnapshot;`)(dependencies);
    const state = {
      characters: [{ id: "one", avatar: imageA }, { id: "two", avatar: "" }],
      chatHistory: {}, chatRooms: {}, activeRoomIds: {}, chatBackgrounds: { one: imageB, extra: imageC },
      groupChats: [], posts: [], lorebooks: [], wallet: { balance: 0, transactions: [], assets: [] },
      characterWallets: {}, transfers: [], apiConfig: {}, apiPresets: [], ttsConfig: {},
      playerProfile: {}, uiLanguage: "en", homeSlots: [null], dockOrder: [],
      fontName: "sans", fontSizeScale: "normal", customCss: "", customFontName: "",
      personaController: { personas: {}, activePersonaId: null }, captureCurrentPersona: () => ({}),
      notificationCenter: { persisted: {}, hydrate() {} },
    };
    const previousLocalStorage = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    try {
      const controller = useSnapshot({ defaultAppState: state, state,
        setters: new Proxy({}, { get: () => () => {} }), applyLoadedAppState() {},
        tr: (_zh, en) => en, sanitizeText: identity,
      });
      let imageUploads = 0;
      mockFetch(async (_url, init) => {
        if (init.method === "HEAD") return new Response(null, { status: 404 });
        imageUploads += 1;
        return Response.json({}, { status: 201 });
      });
      const legacy = await controller.getTextSyncDocument();
      assert.equal(imageUploads, 0);
      assert.equal(legacy.state.characters[0].avatar, undefined);
      let uploadSummary;
      const uploaded = await controller.getTextSyncDocument({ session, environment, onMediaSync: (result) => { uploadSummary = result; } });
      assert.equal(uploaded.state.characters[0].avatar, ref);
      assert.equal(uploaded.formatVersion, 1);
      assert.equal(uploadSummary.uploaded, 3);
      let gets = 0;
      mockFetch(async (_url, init) => { assert.equal(init.method, "GET"); gets += 1; return new Response(blob); });
      const incoming = createTextSyncDocument({
        characters: [{ id: "one", avatar: imageC }, { id: "two", avatar: imageC }],
        chatBackgrounds: { one: imageC, two: imageC },
        featureData: { notes: [{ id: "note", avatar: imageC, text: "After" }] },
      }, { mediaRefs: new Map([[imageC, ref]]) });
      let downloadSummary;
      await controller.applyTextSyncDocument(incoming, { session, environment, onMediaSync: (result) => { downloadSummary = result; } });
      assert.equal(gets, 1);
      assert.equal(savedStates.length, 1);
      const saved = savedStates[0];
      assert.equal(saved.characters[0].avatar, imageA);
      assert.equal(saved.characters[1].avatar, "data:image/png;base64,AQIDBA==");
      assert.equal(saved.chatBackgrounds.one, imageB);
      assert.equal(saved.chatBackgrounds.extra, imageC);
      assert.equal(saved.chatBackgrounds.two, "data:image/png;base64,AQIDBA==");
      assert.equal(featureImports[0].featureData.notes[0].avatar, "data:image/png;base64,AQIDBA==");
      assert.deepEqual(featureImports[0].featureData.gallery, localFeatureData.gallery);
      assert.deepEqual(downloadSummary, { downloaded: 1, failed: 0 });
      assert.doesNotMatch(JSON.stringify(saved), /maliphone-media:/);
      assert.doesNotMatch(JSON.stringify(featureImports), /maliphone-media:/);
    } finally {
      if (previousLocalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousLocalStorage;
    }
  });
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`ok: ${checks} cloud-media sync checks passed`);
