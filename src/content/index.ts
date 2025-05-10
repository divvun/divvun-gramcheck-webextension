console.log("Content script loaded");
import browser from "webextension-polyfill";

const loadWasmModule = async () => {
  try {
    const wasmPath = browser.runtime.getURL("wasm/index_bg.wasm");
    const jsPath = browser.runtime.getURL("wasm/index.js");

    // Load the JS module first
    const jsModule = await import(/* webpackIgnore: true */ jsPath);
    
    // Then fetch and initialize WASM
    const wasmResponse = await fetch(wasmPath);
    const wasmBuffer = await wasmResponse.arrayBuffer();
    
    // Initialize the WASM module
    await jsModule.default(wasmBuffer);
    
    return jsModule;
  } catch (error) {
    console.error("Failed to load WASM module:", error);
    return null;
  }
};

(async () => {
  const mod = await loadWasmModule();

  if (mod) {
    const { add } = mod;
    const sum = add(4, 5);
    console.log("WASM calculation: 4 + 5 =", sum);
  }
})();