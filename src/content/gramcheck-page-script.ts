// Define the error interface in the page context
import { PageScriptInterface, GrammarError, PageScriptCommand, PAGE_SCRIPT_READY } from "../types";
import { apiRequestGrammarCheck, apiRequestLanguageOptions } from "./utils/api";

export {};

// Extend the Window interface to include our global variable
declare global {
  interface Window {
    pageScriptInterface: PageScriptInterface;
  }
}

class GramCheckOverlay extends HTMLElement {
  private currentLanguage: string = 'english';
  
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
          .language-button {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            width: 32px;
            height: 32px;
            padding: 4px;
            cursor: pointer;
            pointer-events: auto;
            z-index: 1000;
          }
          .language-button:hover {
            background: #f5f5f5;
          }
          .language-button img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .language-popup {
            position: absolute;
            bottom: 45px;
            right: 10px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.15);
            z-index: 1001;
            display: none;
            pointer-events: auto;
            min-width: 120px;
          }
          .language-list {
            list-style: none;
            margin: 0;
            padding: 0;
          }
          .language-item {
            padding: 8px 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .language-item:hover {
            background: #f5f5f5;
          }
          .language-item.selected {
            color: #0078D4;
            font-weight: 500;
          }
          // .language-item.selected::after {
          //   content: "✓";
          //   margin-left: 8px;
          // }
        `;

    // Create language button
    const languageButton = document.createElement("button");
    languageButton.setAttribute("class", "language-button");
    const buttonImg = document.createElement("img");
    buttonImg.src = "https://raw.githubusercontent.com/divvun/divvun-gramcheck-web/refs/heads/master/google/assets/icon-48.png";
    buttonImg.alt = "Language Settings";
    languageButton.appendChild(buttonImg);

    // Create language popup
    const languagePopup = document.createElement("div");
    languagePopup.setAttribute("class", "language-popup");
    
    const languageList = document.createElement("ul");
    languageList.setAttribute("class", "language-list");
    
    const languages = ['English', 'Spanish', 'Italian'];
    languages.forEach(lang => {
      const li = document.createElement("li");
      li.setAttribute("class", `language-item${lang.toLowerCase() === this.currentLanguage ? ' selected' : ''}`);
      li.textContent = lang;
      li.addEventListener("click", () => {
        // Remove selected class from all items
        languageList.querySelectorAll('.language-item').forEach(item => {
          item.classList.remove('selected');
        });
        // Add selected class to clicked item
        li.classList.add('selected');
        this.currentLanguage = lang.toLowerCase();
        languagePopup.style.display = "none";
        // Dispatch event for language change
        this.dispatchEvent(new CustomEvent('languageChange', {
          detail: { language: this.currentLanguage }
        }));
      });
      languageList.appendChild(li);
    });
    
    languagePopup.appendChild(languageList);

    // Language button click handler
    languageButton.addEventListener("click", async (event: Event) => {
      const response = await apiRequestGrammarCheck("hello this is some test text", "se");
      console.log("  RESPONISE ");
      console.log(response);

      const langs = await apiRequestLanguageOptions();
      console.log("languages:")
      console.log(langs)

      event.stopPropagation();
      languagePopup.style.display = languagePopup.style.display === "none" ? "block" : "none";
    });

    // Close popup when clicking outside
    document.addEventListener("click", () => {
      languagePopup.style.display = "none";
    });

    // Popup element for errors
    const popup = document.createElement("div");
    popup.setAttribute("class", "popup");
    popup.textContent = "Possible typo?";

    // Append elements to the Shadow DOM
    shadow.appendChild(style);
    shadow.appendChild(overlay);
    shadow.appendChild(popup);
    shadow.appendChild(languageButton);
    shadow.appendChild(languagePopup);

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
window.pageScriptInterface = {
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
  if (event.source !== window || !event.data) return;
  const { type, args } = event.data as PageScriptCommand;
  if (!type || !args) return;

  try {
    switch (type) {
      case "createOverlay":
        window.pageScriptInterface.createOverlay(args.id, args.styles);
        break;
      case "updateOverlay": 
        window.pageScriptInterface.updateOverlay(args.id, args.text, args.errors);
        break;
      case "updatePadding":
        window.pageScriptInterface.updatePadding(args.overlayId, args.textareaId);
        break; 
      default:
        console.warn("Unknown command type:", type);
    }
  } catch (error) {
    console.error("Error executing command:", error);
  }
});

window.postMessage(PAGE_SCRIPT_READY, "*");
