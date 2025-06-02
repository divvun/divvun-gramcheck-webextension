// Define the error interface in the page context
import { GramCheckInterface, GrammarError } from "../types";

export {};

// Extend the Window interface to include our global variable
declare global {
  interface Window {
    gramCheckInterface: GramCheckInterface;
  }
}

class GramCheckOverlay extends HTMLElement {
  constructor() {
    super();

    // Attach Shadow DOM to this element
    const shadow = this.attachShadow({ mode: "open" });

    // Create a container for the overlay
    const overlay = document.createElement("div");
    overlay.setAttribute("class", "overlay");

    // Add styles to the shadow DOM
    const style = document.createElement("style");
    style.textContent = `
          .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            font-size: 16px;
            line-height: 1.5;
            white-space: pre-wrap;
            background-color: rgba(0, 255, 0, 0.2);
            pointer-events: none; /* Prevent interaction */
          }
          .error {
            text-decoration: underline;
            text-decoration-color: red;
            text-decoration-style: wavy;
            pointer-events: auto; /* Enable click events for errors */
            cursor: pointer;
          }
          .popup {
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            padding: 4px 8px;
            box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            display: none;
          }
        `;

    // Popup element
    const popup = document.createElement("div");
    popup.setAttribute("class", "popup");
    popup.textContent = "Possible typo?";

    // Append the overlay and styles to the Shadow DOM
    shadow.appendChild(style);
    shadow.appendChild(overlay);
    shadow.appendChild(popup);

    // Click handler for errors
    overlay.addEventListener("click", (event: Event) => {
      const targetElement = event.target as HTMLElement;
      if (!targetElement) return;

      if (targetElement.classList.contains("error")) {
        console.log("ERROR CLICKED");
        const rect = targetElement.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.top - popup.offsetHeight - 5}px`;
        popup.style.display = "block";
      } else {
        popup.style.display = "none";
      }
    });

    // Hide popup when clicking outside
    document.addEventListener("click", (event: Event) => {
      const targetElement = event.target as HTMLElement;
      if (!targetElement.classList.contains("error")) {
        if (!shadow.contains(targetElement)) {
          //popup.style.display = "none";
        }
      }
    });
  }

  // Update the overlay with highlighted errors
  updateOverlay(text: string, errors: GrammarError[]): void {
    if (!this || !this.shadowRoot) {
      console.log("`this` or `this.shadowRoot` is null!");
      return;
    }

    const overlay = this.shadowRoot.querySelector(".overlay");
    if (!overlay) {
      console.log("overlay is null!");
      return;
    }

    let highlightedText = text;

    // Wrap errors with <span class="error">
    errors.reverse().forEach((error: GrammarError) => {
      const before = highlightedText.slice(0, error.start);
      const after = highlightedText.slice(error.end);
      const errorWord = `<span class="error">${highlightedText.slice(
        error.start,
        error.end
      )}</span>`;
      highlightedText = before + errorWord + after;
    });

    // Set the content of the overlay
    overlay.innerHTML = highlightedText.replace(/\n/g, "<br>");
  }

  updateOverlayPadding(textarea: HTMLTextAreaElement): void {
    if (!this || !this.shadowRoot) return;
    const overlay = this.shadowRoot.querySelector(".overlay") as HTMLDivElement;
    if (!overlay) return;

    const textAreaStyle = window.getComputedStyle(textarea);
    const paddingLeft = parseInt(textAreaStyle.paddingLeft);
    const paddingRight = parseInt(textAreaStyle.paddingRight);
    const paddingTop = parseInt(textAreaStyle.paddingTop);
    const paddingBottom = parseInt(textAreaStyle.paddingBottom);
    const borderLeft = parseInt(textAreaStyle.borderLeftWidth);
    const borderRight = parseInt(textAreaStyle.borderRightWidth);
    const borderTop = parseInt(textAreaStyle.borderTopWidth);
    const borderBottom = parseInt(textAreaStyle.borderBottomWidth);
    const rect = textarea.getBoundingClientRect();

    overlay.style.padding = textAreaStyle.padding;
    overlay.style.width = `${
      rect.width - paddingLeft - paddingRight - borderLeft - borderRight
    }px`;
    overlay.style.height = `${
      rect.height - paddingTop - paddingBottom - borderTop - borderBottom
    }px`;
  }
}

// Define a global interface for content script to communicate with via window.postMessage
window.gramCheckInterface = {
  createOverlay(id: string, styles?: Partial<CSSStyleDeclaration>): string {
    const overlay = document.createElement(
      "spell-check-overlay"
    ) as GramCheckOverlay;
    overlay.id = id;

    // Apply styles
    if (styles) {
      Object.assign(overlay.style, styles);
    }

    document.body.appendChild(overlay);
    return id;
  },

  updateOverlay(id: string, text: string, errors: GrammarError[]): void {
    const overlay = document.getElementById(id) as GramCheckOverlay;
    if (overlay && typeof overlay.updateOverlay === "function") {
      overlay.updateOverlay(text, errors);
    }
  },

  updatePadding(overlayId: string, textareaId: string): void {
    const overlay = document.getElementById(overlayId) as GramCheckOverlay;
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (
      overlay &&
      textarea &&
      typeof overlay.updateOverlayPadding === "function"
    ) {
      overlay.updateOverlayPadding(textarea);
    }
  },
};

// Register the custom element
try {
  customElements.define("spell-check-overlay", GramCheckOverlay);
  console.log("Custom element defined successfully");
} catch (e) {
  console.error("Failed to define custom element:", e);
}

// Setup the message listener for communication with the content script
window.addEventListener("message", (event) => {
  // Make sure the message is from our extension
  if (event.data && event.data.type === "GRAMCHECK_COMMAND") {
    console.log("Page script received message:", event.data);
    const { command, args } = event.data;

    try {
      // Execute the requested command
      if (command === "createOverlay" && window.gramCheckInterface) {
        const [id, styles] = args;
        window.gramCheckInterface.createOverlay(id, styles);
      } else if (command === "updateOverlay" && window.gramCheckInterface) {
        const [id, text, errors] = args;
        window.gramCheckInterface.updateOverlay(id, text, errors);
      } else if (command === "updatePadding" && window.gramCheckInterface) {
        const [overlayId, textareaId] = args;
        window.gramCheckInterface.updatePadding(overlayId, textareaId);
      }
    } catch (error) {
      console.error("Error executing command:", error);
    }
  }
});

console.log("Interface ready:", !!window.gramCheckInterface);

// Signal to the content script that our page script is ready
console.log("Dispatching gramcheck-ready event");
window.postMessage({ type: "GRAMCHECK_READY" }, "*");
