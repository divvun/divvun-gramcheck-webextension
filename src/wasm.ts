import browser from "webextension-polyfill";

export const loadWasm = async () => {
  try {
    const wasmPath = browser.runtime.getURL("wasm/index_bg.wasm");
    const jsPath = browser.runtime.getURL("wasm/index.js");

    // Important to have webpack ignore the wasm js to prevent bundling, which breaks everything
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
