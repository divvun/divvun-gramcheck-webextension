import { loadWasm } from "../wasm";
console.log("Content script loaded");
// import browser from "webextension-polyfill";

(async () => {
  const mod = await loadWasm();

  if (mod) {
    const { add } = mod;
    const sum = add(4, 5);
    console.log("WASM calculation: 4 + 5 =", sum);
  }
})();