import { apiRequestLanguageOptions, apiRequestGrammarCheck, APIGrammarError } from "./utils/api";
import browser from "webextension-polyfill";

interface LanguageChoice {
    code: string;
    displayName: string;
}

export class OverlayManager {
    private currentLanguage: string = 'se';  // Set default language to 'se'
    private overlay: HTMLDivElement;
    private overlayContent: HTMLDivElement;
    private popup: HTMLDivElement;
    private languagePopup: HTMLDivElement;
    private onLanguageChange?: (language: string) => void;
    private currentTextarea: HTMLTextAreaElement | null = null;
    private handleScroll = () => {};  // Will be replaced with actual scroll handler
    private languageButton: HTMLButtonElement;
    private loadingSpinner: HTMLDivElement;
    private typingTimer: ReturnType<typeof setTimeout> | null = null;
    private errorMap: Map<string, APIGrammarError> = new Map();

    constructor() {
        // Create container for overlay with improved initial styles
        this.overlay = document.createElement("div");
        this.overlay.className = "gramcheck-overlay";
        
        // Create loading spinner
        this.loadingSpinner = this.createLoadingSpinner();
        
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
        this.popup.className = "gramcheck-error-popup";
        
        // Create popup structure
        const titleBar = document.createElement("div");
        titleBar.className = "gramcheck-error-popup-title";
        
        const logo = document.createElement("img");
        logo.src = browser.runtime.getURL('icons/icon-32.png');
        logo.alt = "Divvun Logo";
        logo.className = "gramcheck-error-popup-logo";
        titleBar.appendChild(logo);
        
        const title = document.createElement("span");
        title.textContent = "Divvun Grammar Checker";
        title.className = "gramcheck-error-popup-title-text";
        titleBar.appendChild(title);
        
        const closeButton = document.createElement("button");
        closeButton.innerHTML = "×";
        closeButton.className = "gramcheck-error-popup-close";
        closeButton.addEventListener("click", (e) => {
            e.stopPropagation();
            this.popup.style.display = "none";
        });
        titleBar.appendChild(closeButton);
        
        const content = document.createElement("div");
        content.className = "gramcheck-error-popup-content";
        
        const errorTitle = document.createElement("div");
        errorTitle.className = "gramcheck-error-popup-error-title";
        content.appendChild(errorTitle);
        
        const errorDescription = document.createElement("div");
        errorDescription.className = "gramcheck-error-popup-error-description";
        content.appendChild(errorDescription);
        
        const suggestionsList = document.createElement("div");
        suggestionsList.className = "gramcheck-error-popup-suggestions";
        content.appendChild(suggestionsList);
        
        this.popup.appendChild(titleBar);
        this.popup.appendChild(content);

        // Create language selection elements
        this.languagePopup = document.createElement("div");
        this.languagePopup.className = "gramcheck-language-popup";
        
        // Create popup header
        const langTitleBar = document.createElement("div");
        langTitleBar.className = "gramcheck-popup-title";
        
        const langLogo = document.createElement("img");
        langLogo.src = browser.runtime.getURL('icons/icon-32.png');
        langLogo.alt = "Divvun Logo";
        langLogo.className = "gramcheck-popup-logo";
        langTitleBar.appendChild(langLogo);
        
        const langTitle = document.createElement("span");
        langTitle.textContent = "Divvun Grammar Checker";
        langTitle.className = "gramcheck-popup-title-text";
        langTitleBar.appendChild(langTitle);
        
        const langCloseButton = document.createElement("button");
        langCloseButton.innerHTML = "×";
        langCloseButton.className = "gramcheck-popup-close";
        langCloseButton.addEventListener("click", (e) => {
            e.stopPropagation();
            this.languagePopup.style.display = "none";
        });
        langTitleBar.appendChild(langCloseButton);
        
        this.languagePopup.appendChild(langTitleBar);
        
        // Create scrollable container for language list
        const listContainer = document.createElement("div");
        listContainer.className = "gramcheck-language-list-container";
        const languageList = document.createElement("ul");
        languageList.className = "gramcheck-language-list";
        listContainer.appendChild(languageList);
        this.languagePopup.appendChild(listContainer);
        
        this.languageButton = this.createLanguageButton();
        
        // Populate the list asynchronously
        this.populateLanguageList(languageList);

        // Set up event handlers
        this.setupEventHandlers(this.languageButton);

        // Append elements with proper z-index stacking
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.popup);
        this.overlay.appendChild(this.languageButton); // Append button to overlay instead of body
        this.overlay.appendChild(this.loadingSpinner); // Add the loading spinner
        document.body.appendChild(this.languagePopup);

        // Initialize overlays with display: none
        this.popup.style.display = "none";
        this.languagePopup.style.display = "none";
    }

    private createLoadingSpinner(): HTMLDivElement {
        const spinner = document.createElement('div');
        spinner.className = 'gramcheck-spinner';
        spinner.style.display = 'none';
        return spinner;
    }

    private getStylesheet(): string {
        return `
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap');

            :root {
                --font-ui: "Noto Sans", -apple-system, BlinkMacSystemFont, sans-serif;
                --font-system: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .gramcheck-spinner {
                width: 20px;
                height: 20px;
                position: absolute;
                bottom: 10px;
                right: 10px;
                border: 2px solid rgba(0, 0, 0, 0.1);
                border-radius: 50%;
                border-top: 2px solid #0078D4;
                animation: spin 1s linear infinite;
                z-index: 1000;
                box-sizing: border-box;
                pointer-events: none;
            }
            
            .gramcheck-overlay {
                position: absolute;
                background: transparent;
                overflow: hidden;
                box-sizing: border-box;
                padding: 0 !important; /* Override any padding from textarea */
            }
            .gramcheck-content {
                width: 100%;
                height: 100%;
                background: transparent;
                box-sizing: border-box;
            }
            .gramcheck-error {
                text-decoration: underline;
                text-decoration-color: red;
                text-decoration-style: wavy;
                pointer-events: auto;
                cursor: pointer;
            }
            .gramcheck-error-popup {
                position: absolute;
                background: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                display: none;
                min-width: 300px;
                max-width: 400px;
                font-family: var(--font-ui);
            }
            
            .gramcheck-error-popup-title {
                display: flex;
                align-items: center;
                background: #f5f5f5;
                padding: 8px;
                border-bottom: 1px solid #eee;
                border-radius: 4px 4px 0 0;
            }
            
            .gramcheck-error-popup-logo {
                width: 20px;
                height: 20px;
                margin-right: 8px;
            }
            
            .gramcheck-error-popup-title-text {
                flex-grow: 1;
                font-weight: 500;
                font-size: 14px;
                color: #333;
            }
            
            .gramcheck-error-popup-close {
                background: none;
                border: none;
                font-size: 20px;
                color: #666;
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
                font-family: var(--font-system);
            }
            
            .gramcheck-error-popup-close:hover {
                color: #333;
            }
            
            .gramcheck-error-popup-content {
                padding: 12px;
            }
            
            .gramcheck-error-popup-error-title {
                font-weight: 600;
                font-size: 12px;
                color: #333;
                margin-bottom: 8px;
            }
            
            .gramcheck-error-popup-error-description {
                font-weight: 400;
                font-size: 14px;
                color: #666;
                margin-bottom: 12px;
                line-height: 1.4;
            }
            
            .gramcheck-error-popup-suggestions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: flex-start;
            }
            
            .gramcheck-error-popup-suggestion {
                background: #0078D4;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 13px;
                line-height: 1.4;
            }
            
            .gramcheck-error-popup-suggestion:hover {
                background: #006bbe;
            }
            .gramcheck-language-button {
                position: absolute;
                bottom: 10px;
                right: 10px;
                background: #0078D4;
                border: none;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                padding: 0;
                cursor: pointer;
                pointer-events: auto;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
                font-weight: 500;
                font-family: var(--font-ui);
            }
            .gramcheck-language-button.has-errors {
                background: #E81123;
            }
            .gramcheck-language-button:hover {
                filter: brightness(0.9);
            }
            .gramcheck-language-button::before {
                content: "✓";
                display: block;
                font-size: 12px;
            }
            .gramcheck-language-button.has-errors::before {
                content: attr(data-error-count);
            }
            .gramcheck-language-popup {
                position: fixed;
                background: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.15);
                z-index: 1001;
                display: none;
                pointer-events: auto;
                min-width: 240px;
                max-width: 300px;
                max-height: min(400px, calc(100vh - 60px));
                display: none;
                flex-direction: column;
                font-family: var(--font-ui);
            }
            .gramcheck-language-list-container {
                flex: 1;
                overflow-y: auto;
                min-height: 0;
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

            .gramcheck-popup-title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px;
                background: #f5f5f5;
                color: #333;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
                border-bottom: 1px solid #eee;
            }
            .gramcheck-popup-logo {
                width: 24px;
                height: 24px;
                margin-right: 8px;
            }
            .gramcheck-popup-title-text {
                font-size: 14px;
                font-weight: 500;
            }
            .gramcheck-popup-close {
                background: none;
                border: none;
                color: #666;
                font-size: 20px;
                cursor: pointer;
                padding: 0 8px;
            }
            .gramcheck-popup-content {
                padding: 8px;
                max-height: 200px;
                overflow-y: auto;
            }
            .gramcheck-popup-error-title {
                font-weight: 500;
                margin-bottom: 4px;
            }
            .gramcheck-popup-error-description {
                margin-bottom: 8px;
            }
            .gramcheck-popup-suggestions {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                gap: 8px;
            }
            .gramcheck-popup-suggestion {
                background: #0078D4;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 13px;
                line-height: 1.4;
            }
            .gramcheck-popup-suggestion:hover {
                background: #006bbe;
            }
        `;
    }

    private createLanguageButton(): HTMLButtonElement {
        const languageButton = document.createElement("button");
        languageButton.className = "gramcheck-language-button";
        languageButton.title = "Language Settings";
        return languageButton;
    }

    private async populateLanguageList(languageList: HTMLUListElement): Promise<void> {
        try {
            const response = await apiRequestLanguageOptions();
            const availableLanguages = Object.entries(response.available.grammar).map(([code, name]): LanguageChoice => ({
                code,
                displayName: name
            }));
            
            // Populate the list
            availableLanguages.forEach(lang => {
                const li = document.createElement("li");
                li.className = `gramcheck-language-item${lang.code === this.currentLanguage ? ' selected' : ''}`;
                li.textContent = lang.displayName;
                li.dataset.code = lang.code;
                li.addEventListener("click", () => this.handleLanguageSelect(li, lang.code, languageList));
                languageList.appendChild(li);
            });
        } catch (error) {
            console.error("Failed to load available languages:", error);
        }
    }

    private handleLanguageSelect(li: HTMLLIElement, langCode: string, languageList: HTMLUListElement): void {
        languageList.querySelectorAll('.gramcheck-language-item').forEach(item => {
            item.classList.remove('selected');
        });
        li.classList.add('selected');
        this.currentLanguage = langCode;
        this.languagePopup.style.display = "none";
        this.onLanguageChange?.(this.currentLanguage);
    }

    private setupEventHandlers(languageButton: HTMLButtonElement): void {
        // Language button click handler
        languageButton.addEventListener("click", (event: Event) => {
            event.stopPropagation();
            const buttonRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
            
            // Position popup below the button
            const popupTop = buttonRect.bottom + 5;  // 5px gap
            const popupRight = window.innerWidth - buttonRect.right;
            
            // Ensure popup stays within viewport
            this.languagePopup.style.top = `${popupTop}px`;
            this.languagePopup.style.right = `${popupRight}px`;
            this.languagePopup.style.maxHeight = `${window.innerHeight - popupTop - 20}px`;  // 20px bottom margin
            
            this.languagePopup.style.display = this.languagePopup.style.display === "none" ? "block" : "none";
        });

        // Handle error clicks
        this.overlay.addEventListener("click", (event: Event) => {
            const targetElement = event.target as HTMLElement;
            if (!targetElement) return;

            if (targetElement.classList.contains("gramcheck-error")) {
                const errorSpan = targetElement as HTMLSpanElement;
                const errorId = errorSpan.dataset.errorId;
                if (errorId) {
                    const error = this.errorMap.get(errorId);
                    if (error) {
                        // Update popup content
                        this.updatePopupContent(error);
                        
                        // Position popup below the word
                        const rect = targetElement.getBoundingClientRect();
                        this.popup.style.left = `${rect.left}px`;
                        this.popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
                        this.popup.style.display = "block";
                    }
                }
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

    public updateText(text: string, errors: APIGrammarError[]): void {
        // Clear existing errors
        this.errorMap.clear();
        
        let highlightedText = text;
        errors.reverse().forEach((error) => {
            const before = highlightedText.slice(0, error.start_index);
            const after = highlightedText.slice(error.end_index);
            const errorKey = btoa(error.error_text + error.start_index);
            const errorWord = `<span class="gramcheck-error" data-error-id="${errorKey}">${highlightedText.slice(
                error.start_index,
                error.end_index
            )}</span>`;
            highlightedText = before + errorWord + after;
            
            // Store error information for later retrieval
            this.errorMap.set(errorKey, error);
        });

        this.overlayContent.innerHTML = highlightedText.replace(/\n/g, "<br>");
        
        // Update button state with error count
        this.updateButtonState(this.errorMap.size);
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
        
        // Set up textarea event handlers
        this.setupTextareaHandlers(textarea);

        // Disable browser spellcheck when our grammar checker is active
        textarea.spellcheck = false;

        // Set the overlay to exactly match the textarea's position
        this.overlay.style.position = "absolute";
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;
        this.overlay.style.left = `${rect.left + window.scrollX}px`;
        this.overlay.style.top = `${rect.top + window.scrollY}px`;
        this.overlay.style.pointerEvents = "none"; // Allow clicks to pass through to textarea

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

    private async checkGrammar(text: string): Promise<void> {
        try {
            const result = await apiRequestGrammarCheck(text, this.currentLanguage);
            this.updateText(text, result.errs);
        } catch (error) {
            console.error('Grammar check failed:', error);
        } finally {
            // Hide spinner and show button
            this.loadingSpinner.style.display = 'none';
            this.languageButton.style.display = 'block';
        }
    }

    public setLanguageChangeHandler(handler: (language: string) => void): void {
        this.onLanguageChange = handler;
    }

    private setupTextareaHandlers(textarea: HTMLTextAreaElement): void {
        // Remove old listeners if they exist
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
        
        // Set up input handler with immediate update and debounced grammar check
        const handleInput = () => {
            const text = this.currentTextarea?.value || '';
            
            // Clear any existing error highlights and reset button state
            this.updateText(text, []);
            
            // Show spinner and hide button
            this.loadingSpinner.style.display = 'block';
            this.languageButton.style.display = 'none';

            // Clear previous timer
            if (this.typingTimer) {
                clearTimeout(this.typingTimer);
            }

            // Set new timer for grammar checking
            this.typingTimer = setTimeout(() => {
                if (this.currentTextarea) {
                    this.checkGrammar(this.currentTextarea.value);
                }
            }, 1000); // 1 second delay
        };

        textarea.addEventListener('scroll', this.handleScroll);
        textarea.addEventListener('input', handleInput);
        
        // Initial sync
        this.handleScroll();
    }

    private updatePopupContent(error: APIGrammarError): void {
        const content = this.popup.querySelector(".gramcheck-error-popup-content");
        if (!content) return;

        const titleElement = content.querySelector(".gramcheck-error-popup-error-title") as HTMLElement;
        const descriptionElement = content.querySelector(".gramcheck-error-popup-error-description") as HTMLElement;
        const suggestionsElement = content.querySelector(".gramcheck-error-popup-suggestions") as HTMLElement;

        titleElement.textContent = error.title;
        descriptionElement.textContent = error.description;
        
        // Clear and update suggestions
        suggestionsElement.innerHTML = '';
        error.suggestions.forEach(suggestion => {
            const suggestionEl = document.createElement("button");
            suggestionEl.className = "gramcheck-error-popup-suggestion";
            suggestionEl.textContent = suggestion;
            suggestionEl.addEventListener("click", () => {
                if (this.currentTextarea) {
                    // Replace the text in the textarea
                    const start = error.start_index;
                    const end = error.end_index;
                    const value = this.currentTextarea.value;
                    this.currentTextarea.value = value.substring(0, start) + suggestion + value.substring(end);
                    
                    // Trigger input event to update overlay
                    this.currentTextarea.dispatchEvent(new Event('input'));
                    
                    // Hide popup
                    this.popup.style.display = "none";
                }
            });
            suggestionsElement.appendChild(suggestionEl);
        });
    }

    private updateButtonState(errorCount: number): void {
        if (errorCount > 0) {
            this.languageButton.classList.add('has-errors');
            this.languageButton.dataset.errorCount = errorCount.toString();
        } else {
            this.languageButton.classList.remove('has-errors');
            delete this.languageButton.dataset.errorCount;
        }
    }

}
