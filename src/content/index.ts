import { loadWasm } from "../wasm";
import { OverlayManager } from "./overlay-manager";

console.log("Content script loaded");

const overlayMap = new WeakMap<HTMLTextAreaElement, OverlayManager>();

function cleanupOverlay(textarea: HTMLTextAreaElement) {
    const overlay = overlayMap.get(textarea);
    if (overlay) {
        overlay.cleanup();
        overlayMap.delete(textarea);
    }
}

function initializeOverlay(textarea: HTMLTextAreaElement) {
    if (overlayMap.has(textarea)) {
        return;
    }

    const overlay = new OverlayManager();
    overlayMap.set(textarea, overlay);

    const resizeObserver = new ResizeObserver(() => overlay.updatePosition(textarea));
    resizeObserver.observe(textarea);

    // Watch for scroll events
    const scrollHandler = () => overlay.updatePosition(textarea);
    window.addEventListener('scroll', scrollHandler, true);
    textarea.addEventListener('scroll', scrollHandler);

    // Initial position update
    overlay.updatePosition(textarea);
    
    // Trigger initial text update with existing content
    const initialText = textarea.value;
    if (initialText) {
        overlay.updateText(initialText, []);
        textarea.dispatchEvent(new Event('input'));
    }

    // Listen for input events
    textarea.addEventListener('input', () => {
        const text = textarea.value;
        overlay.updateText(text, []); // You'll need to implement actual error checking here
    });
}

function initializeAllTextareas() {
    const textareas = document.getElementsByTagName("textarea");
    Array.from(textareas).forEach(textarea => {
        initializeOverlay(textarea);
    });
}

function handleRemovedNode(node: Node) {
    // If the node is a textarea, clean it up directly
    if (node.nodeName === 'TEXTAREA') {
        cleanupOverlay(node as HTMLTextAreaElement);
    }
    
    // If the node might contain textareas, look for them
    if (node.nodeType === Node.ELEMENT_NODE) {
        const textareas = (node as Element).getElementsByTagName('textarea');
        Array.from(textareas).forEach(textarea => {
            cleanupOverlay(textarea);
        });
    }
}

function observeDOM() {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            // Handle added nodes
            mutation.addedNodes.forEach(node => {
                if (node.nodeName === 'TEXTAREA') {
                    initializeOverlay(node as HTMLTextAreaElement);
                }
                // Check for textareas within added nodes
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const textareas = (node as Element).getElementsByTagName('textarea');
                    Array.from(textareas).forEach(textarea => {
                        initializeOverlay(textarea);
                    });
                }
            });

            // Handle direct textarea removals only
            mutation.removedNodes.forEach(handleRemovedNode);
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    window.addEventListener('unload', () => {
        const textareas = document.getElementsByTagName("textarea");
        Array.from(textareas).forEach(cleanupOverlay);
    });
}

async function initialize() {
  const mod = await loadWasm();
  if (mod) {
    console.log("WASM module loaded successfully");
    console.log("Calling wasm add function: 4 + 5 = ", mod.add(4, 5));
  } else {
    console.error("Failed to load WASM module. This is likely caused by the current site not allowing WASM to be loaded. In a future version, WASM will be loaded in the background script to circumvent this issue.");
  }

  // Wait for DOM to be ready if needed
  if (document.readyState === "loading") {
    await new Promise((resolve) =>
      document.addEventListener("DOMContentLoaded", resolve)
    );
  }

  initializeAllTextareas();

  // Start observing for new textareas
  observeDOM();
}

initialize();