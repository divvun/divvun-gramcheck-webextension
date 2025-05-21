import { loadWasm } from "../wasm";
import { GramCheckOverlay } from "./gramcheck-overlay";
import { GrammarError } from "../types";

console.log("Content script loaded");
// import browser from "webextension-polyfill";

// const overlay = document.createElement("spell-check-overlay");
// overlay.style.position = "absolute";
// overlay.style.left = "100px";
// overlay.style.top = "100px";
// overlay.style.height = "100px";
// overlay.style.width = "100px";
// overlay.style.backgroundColor = "green";
// document.body.appendChild(overlay);

(async () => {
  const mod = await loadWasm();

  if (mod) {
    const { add } = mod;
    const sum = add(4, 5);
    console.log("WASM calculation: 4 + 5 =", sum);
  }
})();


customElements.define("spell-check-overlay", GramCheckOverlay);

// Create an instance of the custom element
const overlay: GramCheckOverlay = document.createElement("spell-check-overlay") as GramCheckOverlay;
document.body.appendChild(overlay);
updateOverlay();

// Example Usage
const textarea: HTMLTextAreaElement | null = document.getElementById("text-input") as HTMLTextAreaElement;

const resizeObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    const { width, height } = entry.contentRect; // Get the new size
    overlay.updateOverlayPadding(textarea);
    console.log(`Textarea resized: ${width}px x ${height}px`);
  }
});

resizeObserver.observe(textarea);

const textAreaStyle = window.getComputedStyle(textarea);

// Position the overlay over the textarea
const rect = textarea.getBoundingClientRect();
overlay.style.position = "absolute";
overlay.style.pointerEvents = "none";
overlay.style.top = `${rect.bottom + 10}px`;
//overlay.style.top = `${rect.top + window.scrollY}px`;
overlay.style.left = `${rect.left + window.scrollX}px`;
overlay.style.width = `${rect.width}px`;
overlay.style.height = `${rect.height}px`;
overlay.style.backgroundColor = "rgba(0, 0, 255, 0.2)";
//overlay.style.margin = textarea.style.margin;
//overlay.style.padding = `${textAreaStyle.padding}`;
copyStyles(textarea, overlay);

const paddingInt = parseInt(textAreaStyle.padding);
overlay.updateOverlayPadding(textarea);

// Mock spell-check function
function spellCheck(text: string) {
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

// Update the overlay on input
textarea.addEventListener("input", () => {
  updateOverlay();
});

function copyStyles(source: HTMLTextAreaElement, target: GramCheckOverlay) {
  const computedStyle = window.getComputedStyle(source);
  const propertiesToCopy = [
    "font",
    "color",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textTransform",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    //"padding",
    "border",
    "boxSizing",
    "width",
    "height",
  ];

  propertiesToCopy.forEach((property: any) => {
    target.style[property] = computedStyle[property];
  });
}

function updateOverlay() {
  if (!textarea) return
  const text = textarea.value;
  const errors = spellCheck(text);
  overlay.updateOverlay(text, errors);
  //  overlay.innerText = textarea.value;
}