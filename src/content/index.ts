import { GrammarError } from "../types";
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

        // Set up textarea event listeners
        textarea.addEventListener("input", () => {
            const text = textarea.value;
            const errors = checkGrammar(text);
            overlay.updateText(text, errors);
        });

        // Watch for textarea size changes
        const resizeObserver = new ResizeObserver(() => overlay.updatePosition(textarea));
        resizeObserver.observe(textarea);

        // Watch for scroll events
        window.addEventListener('scroll', () => overlay.updatePosition(textarea), true);
        textarea.addEventListener('scroll', () => overlay.updatePosition(textarea));
        
        // Initial update
        overlay.updatePosition(textarea);
        overlay.updateText(textarea.value, checkGrammar(textarea.value));

        // Handle language changes
        overlay.setLanguageChangeHandler((language: string) => {
            console.log("Language changed to:", language);
            const text = textarea.value;
            const errors = checkGrammar(text);
            overlay.updateText(text, errors);
        });
    } catch (error) {
        console.error("Failed to initialize grammar checker:", error);
    }
}

// Temporary mock grammar check function (to be replaced with actual WASM implementation)
function checkGrammar(text: string): GrammarError[] {
    const errors: GrammarError[] = [];
    const words = text.split(/\s+/);

    words.forEach((word, index) => {
        if (word.toLowerCase() === "som") {
            const start = text.indexOf(word, errors.length ? errors[errors.length - 1].end : 0);
            errors.push({
                word,
                start,
                end: start + word.length,
            });
        }
    });

    return errors;
}



// Start initialization when script loads
initialize();