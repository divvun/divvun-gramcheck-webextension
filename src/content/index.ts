import { loadWasm } from "../wasm";
import { GrammarError } from "../types";
import browser from "webextension-polyfill";

console.log("Content script loaded. Document readyState:", document.readyState);

// Define interface for the window.gramCheckInterface that will be injected
interface GramCheckInterface {
  createOverlay: (id: string, styles?: Partial<CSSStyleDeclaration>) => string;
  updateOverlay: (id: string, text: string, errors: GrammarError[]) => void;
  updatePadding: (overlayId: string, textareaId: string) => void;
}

// This proxy will handle communication with the page script
class GramCheckProxy implements GramCheckInterface {
  private ready: boolean = false;

  constructor() {
    // Listen for messages from the page script
    window.addEventListener("message", (event) => {
      // Make sure the message is from our page
      if (event.source !== window) return;

      if (event.data && event.data.type === "GRAMCHECK_READY") {
        console.log("Content script received GRAMCHECK_READY");
        this.ready = true;
        // Dispatch our own event for the content script
        window.dispatchEvent(new CustomEvent("gramcheck-proxy-ready"));
      }
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  createOverlay(id: string, styles?: Partial<CSSStyleDeclaration>): string {
    if (!this.ready) {
      console.warn("GramCheckProxy: Interface not ready");
      return "";
    }

    window.postMessage(
      {
        type: "GRAMCHECK_COMMAND",
        command: "createOverlay",
        args: [id, styles],
      },
      "*"
    );

    return id;
  }

  updateOverlay(id: string, text: string, errors: GrammarError[]): void {
    if (!this.ready) {
      console.warn("GramCheckProxy: Interface not ready");
      return;
    }

    window.postMessage(
      {
        type: "GRAMCHECK_COMMAND",
        command: "updateOverlay",
        args: [id, text, errors],
      },
      "*"
    );
  }

  updatePadding(overlayId: string, textareaId: string): void {
    if (!this.ready) {
      console.warn("GramCheckProxy: Interface not ready");
      return;
    }

    window.postMessage(
      {
        type: "GRAMCHECK_COMMAND",
        command: "updatePadding",
        args: [overlayId, textareaId],
      },
      "*"
    );
  }
}

// Create our proxy
const gramCheckProxy = new GramCheckProxy();

// Load WASM module
(async () => {
  const mod = await loadWasm();

  if (mod) {
    const { add } = mod;
    const sum = add(4, 5);
    console.log("WASM calculation: 4 + 5 =", sum);
  }
})();

// Inject the external TypeScript script file into the page context
function injectPageScript(): Promise<void> {
  console.log("Injecting page script");
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");

    // Get the URL for our script file from the extension
    script.src = browser.runtime.getURL("gramcheck-page-script.js");

    // Clean up after loading
    script.onload = () => {
      console.log("Page script loaded successfully");
      script.remove();
      resolve();
    };

    // Handle any errors
    script.onerror = (error) => {
      console.error("Failed to load script:", error);
      reject(error);
    };

    // Append the script to the page
    (document.head || document.documentElement).appendChild(script);
  });
}

// Wait for the proxy to be ready
function waitForProxyReady(maxWaitTime = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gramCheckProxy.isReady()) {
      resolve();
      return;
    }

    const startTime = Date.now();

    // Set up the event listener
    const listener = () => {
      console.log("gramcheck-proxy-ready event received");
      window.removeEventListener("gramcheck-proxy-ready", listener);
      resolve();
    };

    window.addEventListener("gramcheck-proxy-ready", listener);

    // Timeout if it takes too long
    setTimeout(() => {
      if (!gramCheckProxy.isReady()) {
        window.removeEventListener("gramcheck-proxy-ready", listener);
        reject(new Error("Timeout waiting for gramCheckProxy to be ready"));
      }
    }, maxWaitTime);
  });
}

// Intelligent initialization based on document state
function initializeExtension() {
  console.log("Initialize extension called, readyState:", document.readyState);

  if (document.readyState === "loading") {
    // Still loading, wait for the DOMContentLoaded event
    console.log("Document still loading, waiting for DOMContentLoaded");
    document.addEventListener("DOMContentLoaded", () => {
      console.log("DOMContentLoaded fired");
      startExtension();
    });
  } else {
    // DOM already loaded (interactive or complete), initialize immediately
    console.log("Document already loaded, initializing immediately");
    startExtension();
  }
}

// Start the extension features
async function startExtension() {
  try {
    // Inject our script
    await injectPageScript();

    // Wait for the proxy to be ready
    await waitForProxyReady();

    // Initialize our overlay
    initializeOverlay();
  } catch (err) {
    console.error("Failed to initialize extension:", err);
    // Try one more time with a delay as a last resort
    setTimeout(() => {
      console.log("Final attempt to initialize overlay");
      if (gramCheckProxy.isReady()) {
        initializeOverlay();
      } else {
        console.error("Cannot initialize overlay: proxy not ready");
      }
    }, 1000);
  }
}

function initializeOverlay(): void {
  console.log("Initializing overlay");

  // Safety check
  if (!gramCheckProxy.isReady()) {
    console.error("Cannot initialize overlay: proxy not ready");
    return;
  }

  const textarea = document.getElementById("text-input") as HTMLTextAreaElement;
  if (!textarea) {
    console.log(
      "Textarea not found! Searched for element with ID 'text-input'"
    );
    // Try to find the textarea another way if needed
    const textareas = document.getElementsByTagName("textarea");
    console.log(`Found ${textareas.length} textareas on the page`);

    if (textareas.length > 0) {
      console.log("Using the first textarea on the page");
      // Use the first textarea as a fallback
      createOverlayForTextarea(textareas[0]);
    }
    return;
  }

  createOverlayForTextarea(textarea);
}

function createOverlayForTextarea(textarea: HTMLTextAreaElement): void {
  const overlayId = "grammar-check-overlay";

  // Get position and styles for the overlay
  const rect = textarea.getBoundingClientRect();
  console.log("Textarea position:", rect);

  const styles = {
    position: "absolute",
    pointerEvents: "none",
    top: `${rect.bottom + 10}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    backgroundColor: "rgba(0, 0, 255, 0.2)",
  };

  // Create our overlay using the proxy
  try {
    gramCheckProxy.createOverlay(overlayId, styles as any);
    console.log("Overlay created successfully");

    // Set up event listeners
    textarea.addEventListener("input", () => {
      updateOverlay(overlayId, textarea);
    });

    // Initialize the first update
    updateOverlay(overlayId, textarea);

    // Create a resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      try {
        gramCheckProxy.updatePadding(overlayId, textarea.id || "text-input");
      } catch (e) {
        console.error("Error updating padding:", e);
      }
    });

    resizeObserver.observe(textarea);
  } catch (e) {
    console.error("Failed to create overlay:", e);
  }
}

function updateOverlay(overlayId: string, textarea: HTMLTextAreaElement): void {
  if (!textarea || !gramCheckProxy.isReady()) return;

  const text = textarea.value;
  const errors = spellCheck(text);

  try {
    gramCheckProxy.updateOverlay(overlayId, text, errors);
  } catch (e) {
    console.error("Error updating overlay:", e);
  }
}

// Mock spell-check function
function spellCheck(text: string): GrammarError[] {
  const errors: GrammarError[] = [];
  const words = text.split(/\s+/);
  words.forEach((word, index) => {
    if (word.toLowerCase() === "som") {
      // Simulate "som" as a typo
      const start = text.indexOf(
        word,
        errors.length ? errors[errors.length - 1].end : 0
      );
      errors.push({ word, start, end: start + word.length });
    }
  });
  return errors;
}

// Start the extension
initializeExtension();

// Additional debug listeners
window.addEventListener("load", () => {
  console.log("Window load event fired");
});

document.addEventListener("readystatechange", () => {
  console.log("readystatechange event fired. New state:", document.readyState);
});
