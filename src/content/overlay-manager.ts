import { GrammarError } from "../types";
import { apiRequestLanguageOptions } from "./utils/api";
import browser from "webextension-polyfill";

export class OverlayManager {
    private currentLanguage: string = 'english';
    private overlay: HTMLDivElement;
    private overlayContent: HTMLDivElement;
    private popup: HTMLDivElement;
    private languagePopup: HTMLDivElement;
    private onLanguageChange?: (language: string) => void;
    private currentTextarea: HTMLTextAreaElement | null = null;
    private handleScroll = () => {};  // Will be replaced with actual scroll handler

    constructor() {
        // Create container for overlay with improved initial styles
        this.overlay = document.createElement("div");
        this.overlay.className = "gramcheck-overlay";
        
        // Create a content container for the text
        this.overlayContent = document.createElement("div");
        this.overlayContent.className = "gramcheck-content";
        this.overlay.appendChild(this.overlayContent);
        
        // Create style element
        const style = document.createElement("style");
        style.textContent = this.getStylesheet();
        document.head.appendChild(style);

        // Create error popup with improved styling
        this.popup = document.createElement("div");
        this.popup.className = "gramcheck-popup";
        this.popup.textContent = "Possible typo?";

        // Create language selection elements
        this.languagePopup = document.createElement("div");
        this.languagePopup.className = "gramcheck-language-popup";
        
        const languageButton = this.createLanguageButton();
        const languageList = this.createLanguageList();
        this.languagePopup.appendChild(languageList);

        // Set up event handlers
        this.setupEventHandlers(languageButton);

        // Append elements with proper z-index stacking
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.popup);
        this.overlay.appendChild(languageButton); // Append button to overlay instead of body
        document.body.appendChild(this.languagePopup);

        // Initialize overlays with display: none
        this.popup.style.display = "none";
        this.languagePopup.style.display = "none";
    }

    private getStylesheet(): string {
        return `
            .gramcheck-overlay {
                position: absolute;
                background-color: rgba(0, 0, 255, 0.2);
                overflow: hidden;
                box-sizing: border-box;
                padding: 0 !important; /* Override any padding from textarea */
            }
            .gramcheck-content {
                background-color: rgba(255, 255, 255, 0.8);
                box-sizing: border-box;
            }
            .gramcheck-error {
                text-decoration: underline;
                text-decoration-color: red;
                text-decoration-style: wavy;
                pointer-events: auto;
                cursor: pointer;
            }
            .gramcheck-popup {
                position: absolute;
                background: white;
                border: 1px solid #ccc;
                padding: 4px 8px;
                box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                display: none;
            }
            .gramcheck-language-button {
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
            .gramcheck-language-button:hover {
                background: #f5f5f5;
            }
            .gramcheck-language-button img {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
            .gramcheck-language-popup {
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
            .gramcheck-language-list {
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .gramcheck-language-item {
                padding: 8px 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .gramcheck-language-item:hover {
                background: #f5f5f5;
            }
            .gramcheck-language-item.selected {
                color: #0078D4;
                font-weight: 500;
            }
            .gramcheck-language-item.selected::after {
                content: "✓";
                margin-left: 8px;
            }
        `;
    }

    private createLanguageButton(): HTMLButtonElement {
        const languageButton = document.createElement("button");
        languageButton.className = "gramcheck-language-button";
        const buttonImg = document.createElement("img");
        buttonImg.src = browser.runtime.getURL('icons/icon-32.png');
        buttonImg.alt = "Language Settings";
        languageButton.appendChild(buttonImg);
        return languageButton;
    }

    private createLanguageList(): HTMLUListElement {
        const languageList = document.createElement("ul");
        languageList.className = "gramcheck-language-list";
        
        const languages = ['English', 'Spanish', 'Italian'];
        languages.forEach(lang => {
            const li = document.createElement("li");
            li.className = `gramcheck-language-item${lang.toLowerCase() === this.currentLanguage ? ' selected' : ''}`;
            li.textContent = lang;
            li.addEventListener("click", () => this.handleLanguageSelect(li, lang, languageList));
            languageList.appendChild(li);
        });
        
        return languageList;
    }

    private handleLanguageSelect(li: HTMLLIElement, lang: string, languageList: HTMLUListElement): void {
        languageList.querySelectorAll('.gramcheck-language-item').forEach(item => {
            item.classList.remove('selected');
        });
        li.classList.add('selected');
        this.currentLanguage = lang.toLowerCase();
        this.languagePopup.style.display = "none";
        this.onLanguageChange?.(this.currentLanguage);
    }

    private setupEventHandlers(languageButton: HTMLButtonElement): void {
        // Language button click handler
        languageButton.addEventListener("click", async (event: Event) => {
            event.stopPropagation();
            if (this.languagePopup.style.display === "none") {
                try {
                    const langs = await apiRequestLanguageOptions();
                    console.log("Available languages:", langs);
                } catch (error) {
                    console.error("Failed to fetch languages:", error);
                }
            }
            this.languagePopup.style.display = this.languagePopup.style.display === "none" ? "block" : "none";
        });

        // Handle error clicks
        this.overlay.addEventListener("click", (event: Event) => {
            const targetElement = event.target as HTMLElement;
            if (!targetElement) return;

            if (targetElement.classList.contains("gramcheck-error")) {
                const rect = targetElement.getBoundingClientRect();
                this.popup.style.left = `${rect.left}px`;
                this.popup.style.top = `${rect.top - this.popup.offsetHeight - 5}px`;
                this.popup.style.display = "block";
            } else {
                this.popup.style.display = "none";
            }
        });

        // Close popups when clicking outside
        document.addEventListener("click", () => {
            this.languagePopup.style.display = "none";
            if (!this.overlay.contains(event?.target as Node)) {
                this.popup.style.display = "none";
            }
        });
    }

    public updateText(text: string, errors: GrammarError[]): void {
        let highlightedText = text;
        errors.reverse().forEach((error: GrammarError) => {
            const before = highlightedText.slice(0, error.start);
            const after = highlightedText.slice(error.end);
            const errorWord = `<span class="gramcheck-error">${highlightedText.slice(
                error.start,
                error.end
            )}</span>`;
            highlightedText = before + errorWord + after;
        });

        this.overlayContent.innerHTML = highlightedText.replace(/\n/g, "<br>");
    }

    private getStyles(source: HTMLTextAreaElement): Partial<CSSStyleDeclaration> {
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
          "border",
          "width",
          "height",
          // // Font properties
          // "font", "color", "fontSize", "fontFamily", "fontWeight", "fontStyle",
          // "lineHeight", "letterSpacing", "wordSpacing", "textTransform",
          // "textIndent", "textAlign", "direction",

          // // Box model
          // // "padding",
          // "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
          // "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
          // "border", "borderWidth", "borderStyle", "borderColor",
          // "borderRadius", "borderTopLeftRadius", "borderTopRightRadius",
          // "borderBottomLeftRadius", "borderBottomRightRadius",

          // // Sizing and positioning
          // "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
          // "boxSizing",

          // // Visual properties
          // "backgroundColor", "backgroundImage", "backgroundPosition", "backgroundRepeat",
          // "boxShadow", "opacity",

          // // Text overflow and wrapping
          // "whiteSpace", "wordBreak", "overflowWrap", "textOverflow",

          // // Scrolling
          // "overflowX", "overflowY"
        ];

        const styles: Partial<CSSStyleDeclaration> = {};
        propertiesToCopy.forEach((property) => {
            const value = computedStyle.getPropertyValue(property);
            if (value) {
                styles[property as any] = value;
            }
        });
        return styles;
    }

    public updatePosition(textarea: HTMLTextAreaElement): void {
        const rect = textarea.getBoundingClientRect();
        const styles = this.getStyles(textarea);

        // Apply textarea styles to overlay
        Object.assign(this.overlay.style, styles);
        
        // Apply padding and scroll styles to content container
        const computedStyle = window.getComputedStyle(textarea);
        this.overlayContent.style.padding = computedStyle.padding;
        
        // Set up scroll syncing for the new textarea
        this.setupScrollSync(textarea);

        // Set specific overlay positioning and appearance
        this.overlay.style.position = "absolute";
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.left = `${rect.left + window.scrollX}px`;
        this.overlay.style.top = `${rect.bottom + window.scrollY + 10}px`;

        // Override specific styles for the overlay's functionality
        // this.overlay.style.backgroundColor = "white"; // Make overlay background white
        // this.overlay.style.pointerEvents = "auto"; // Enable interaction
        // this.overlay.style.minHeight = "100px"; // Minimum height for visibility
        // this.overlay.style.maxHeight = "200px"; // Maximum height before scrolling
        // this.overlay.style.overflowY = "auto"; // Enable vertical scrolling if needed
        // this.overlay.style.border = "1px solid #ccc"; // Add a light border
        // this.overlay.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)"; // Add subtle shadow
        // this.overlay.style.zIndex = "1000"; // Ensure overlay appears above other content
    }

    private setupScrollSync(textarea: HTMLTextAreaElement): void {
        // Remove old scroll listener if it exists
        if (this.currentTextarea) {
            this.currentTextarea.removeEventListener('scroll', this.handleScroll);
        }

        // Set up new scroll listener
        this.currentTextarea = textarea;
        this.handleScroll = () => {
            if (this.currentTextarea) {
                this.overlayContent.style.transform = `translateY(-${this.currentTextarea.scrollTop}px)`;
            }
        };
        
        textarea.addEventListener('scroll', this.handleScroll);
        
        // Initial sync
        this.handleScroll();
    }

    public setLanguageChangeHandler(handler: (language: string) => void): void {
        this.onLanguageChange = handler;
    }
}
