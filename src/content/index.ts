import { loadWasm } from "../wasm";
import { OverlayManager } from "./overlay-manager";

console.log("Content script loaded");

async function initialize() {
    try {
        // Load WASM module first
        const mod = await loadWasm();
        if (!mod) {
            throw new Error("Failed to load WASM module");
        }
        console.log("WASM module loaded successfully");

        // Wait for DOM to be ready if needed
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        // Find textareas and initialize overlay
        const textareas = document.getElementsByTagName("textarea");
        if (textareas.length === 0) {
            console.log("No textarea found on the page");
            return;
        }

        // Create and configure the overlay for the first textarea
        const textarea = textareas[0];
        const overlay = new OverlayManager();

        // Watch for textarea size changes
        const resizeObserver = new ResizeObserver(() => overlay.updatePosition(textarea));
        resizeObserver.observe(textarea);

        // Watch for scroll events
        window.addEventListener('scroll', () => overlay.updatePosition(textarea), true);
        textarea.addEventListener('scroll', () => overlay.updatePosition(textarea));
        
        // Initial position update
        overlay.updatePosition(textarea);
        
        // Trigger initial text update with existing content
        const initialText = textarea.value;
        if (initialText) {
            // Update the overlay with initial text and simulate input to trigger grammar check
            overlay.updateText(initialText, []);
            textarea.dispatchEvent(new Event('input'));
        }
    } catch (error) {
        console.error("Failed to initialize grammar checker:", error);
    }
}

// Start initialization when script loads
initialize();