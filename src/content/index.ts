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

// Extend window interface to include our injected interface
declare global {
  interface Window {
    gramCheckInterface: GramCheckInterface;
  }
}

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

// Check for the interface with a timeout
function waitForInterface(
  maxWaitTime = 2000,
  checkInterval = 50
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("Waiting for gramCheckInterface to be available");
    const startTime = Date.now();

    function checkInterface() {
      if (window.gramCheckInterface) {
        console.log("gramCheckInterface is now available");
        resolve();
        return;
      }

      if (Date.now() - startTime > maxWaitTime) {
        reject(new Error("Timeout waiting for gramCheckInterface"));
        return;
      }

      setTimeout(checkInterface, checkInterval);
    }

    checkInterface();
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

    // Set up a listener for when the page script is ready
    const readyPromise = new Promise<void>((resolve) => {
      window.addEventListener("gramcheck-ready", () => {
        console.log("gramcheck-ready event received");
        resolve();
      });
    });

    // Wait for either the ready event or for the interface to be available
    await Promise.race([readyPromise, waitForInterface()]);

    // Initialize our overlay
    initializeOverlay();
  } catch (err) {
    console.error("Failed to initialize extension:", err);
    // Try one more time with a delay as a last resort
    setTimeout(() => {
      console.log("Final attempt to initialize overlay");
      if (window.gramCheckInterface) {
        initializeOverlay();
      } else {
        console.error(
          "Cannot initialize overlay: gramCheckInterface not available"
        );
      }
    }, 1000);
  }
}

function initializeOverlay(): void {
  console.log("Initializing overlay");

  // Safety check
  if (!window.gramCheckInterface) {
    console.error(
      "Cannot initialize overlay: gramCheckInterface not available"
    );
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

  // Create our overlay using the page context interface
  try {
    window.gramCheckInterface!.createOverlay(overlayId, styles as any);
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
        if (window.gramCheckInterface) {
          window.gramCheckInterface.updatePadding(
            overlayId,
            textarea.id || "text-input"
          );
        }
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
  if (!textarea || !window.gramCheckInterface) return;

  const text = textarea.value;
  const errors = spellCheck(text);

  try {
    window.gramCheckInterface.updateOverlay(overlayId, text, errors);
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
