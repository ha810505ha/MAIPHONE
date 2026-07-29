import assert from "node:assert/strict";
import {
  loadMusicSdk,
  withMusicTimeout,
} from "../services/music/musicSdkLoader.js";

const createFakeDocument = () => {
  const documentObject = {
    scripts: [],
    head: {
      appendChild(script) {
        documentObject.scripts.push(script);
      },
    },
    createElement() {
      const listeners = new Map();
      return {
        src: "",
        async: false,
        removed: false,
        getAttribute(name) {
          return name === "src" ? this.src : null;
        },
        addEventListener(name, listener) {
          listeners.set(name, listener);
        },
        removeEventListener(name, listener) {
          if (listeners.get(name) === listener) listeners.delete(name);
        },
        emit(name, value) {
          listeners.get(name)?.(value);
        },
        remove() {
          this.removed = true;
          const index = documentObject.scripts.indexOf(this);
          if (index >= 0) documentObject.scripts.splice(index, 1);
        },
      };
    },
  };
  return documentObject;
};

const globalObject = {};
const documentObject = createFakeDocument();
const firstLoad = loadMusicSdk({
  src: "https://example.test/music-sdk.js",
  label: "Test Music",
  callbackName: "onTestMusicReady",
  getReady: () => globalObject.musicApi || null,
  timeoutMs: 100,
  globalObject,
  documentObject,
});
const failedScript = documentObject.scripts[0];
failedScript.emit("error");
await assert.rejects(firstLoad, (error) => error?.code === "MUSIC_SDK_LOAD_FAILED");
assert.equal(failedScript.removed, true);
assert.equal(globalObject.onTestMusicReady, undefined);

const retryLoad = loadMusicSdk({
  src: "https://example.test/music-sdk.js",
  label: "Test Music",
  callbackName: "onTestMusicReady",
  getReady: (api) => {
    if (api) globalObject.musicApi = api;
    return globalObject.musicApi || null;
  },
  timeoutMs: 100,
  globalObject,
  documentObject,
});
const api = { play() {} };
globalObject.onTestMusicReady(api);
assert.equal(await retryLoad, api);
assert.equal(documentObject.scripts.length, 1);

let timedOut = false;
await assert.rejects(
  withMusicTimeout(new Promise(() => {}), {
    label: "Test Player",
    timeoutMs: 5,
    onTimeout: () => { timedOut = true; },
  }),
  (error) => error?.code === "MUSIC_SDK_TIMEOUT",
);
assert.equal(timedOut, true);

const contextSource = await import("node:fs/promises")
  .then(({ readFile }) => readFile(new URL("../contexts/MusicPlayerContext.jsx", import.meta.url), "utf8"));
assert.match(contextSource, /setIsPlaying\(false\);\s*const guardedCallbacks/);
assert.doesNotMatch(contextSource, /setIsPlaying\(true\);\s*await provider\.load/);
assert.match(contextSource, /resume\(\) \{ providerRef\.current\?\.resume\(\); \}/);

console.log("music provider safety: ok");
