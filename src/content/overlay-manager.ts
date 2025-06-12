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
        
        // Create the container for SVG and dropdown
        const container = document.createElement("div");
        container.className = "gramcheck-language-container";

        // Add the language icon SVG by embedding it
        const icon = document.createElement('div');
        icon.className = "gramcheck-language-icon";
        icon.innerHTML = `<svg width="34" height="19" viewBox="0 0 34 19" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.5059 5.38781H10.7306V1.68405C10.7306 1.16844 10.293 0.75 9.75302 0.75C9.21299 0.75 8.77543 1.16844 8.77543 1.68405V5.38781H1.97758C1.43794 5.38781 1 5.80625 1 6.32186C1 6.83784 1.43794 7.2559 1.97758 7.2559H12.2444C11.25 9.17197 8.54093 13.0787 1.94966 16.3287C1.546 16.5249 1.33599 16.96 1.44236 17.3807C1.54873 17.8014 1.94342 18.097 2.39618 18.0951C2.55242 18.0962 2.70593 18.0594 2.84308 17.9886C5.17304 16.8704 7.3433 15.4713 9.3004 13.8254L14.7186 18.0367C14.8904 18.1748 15.1082 18.2507 15.333 18.25C15.748 18.2519 16.1189 18.0035 16.2584 17.6302C16.3979 17.2568 16.2755 16.8398 15.9529 16.5904L10.7304 12.4968C12.2885 10.9854 13.5353 9.20774 14.4058 7.25593H17.5224C18.0624 7.25593 18.5 6.83787 18.5 6.32189C18.5 5.80628 18.0624 5.38784 17.5224 5.38784L17.5059 5.38781Z" fill="currentColor" stroke="currentColor"/>
            <path d="M33.246 16.9744L26.8481 1.27152L26.7678 1.15987C26.7678 1.15987 26.7678 1.10683 26.7278 1.08531L26.6647 1.01076L26.6187 0.946959L26.5444 0.893917C26.522 0.871662 26.4973 0.852003 26.4697 0.835312L26.3894 0.792656L26.2919 0.75H25.5879L25.4904 0.792656L25.4101 0.835312L25.3358 0.888354L25.2615 0.946959L25.1984 1.01595V1.01632C25.176 1.04006 25.1548 1.06491 25.1352 1.09051L25.0893 1.1595V1.15987C25.0717 1.1888 25.0565 1.21921 25.0437 1.25037L18.5655 16.9741C18.3677 17.4615 18.633 18.0056 19.158 18.1893C19.6834 18.3729 20.2691 18.1262 20.4669 17.6388L21.9964 13.8847H29.8435L31.3501 17.6388C31.5004 17.9993 31.8731 18.2375 32.2895 18.2397C32.4109 18.2397 32.5316 18.2178 32.6447 18.1759C32.896 18.091 33.1009 17.9162 33.2136 17.6907C33.3267 17.4656 33.3383 17.2074 33.246 16.9741L33.246 16.9744ZM22.7579 12.0236L25.9079 4.22835L29.0583 12.0236H22.7579Z" fill="currentColor" stroke="currentColor"/></svg>`;
        container.appendChild(icon);

        // Create the select element
        const select = document.createElement("select");
        select.className = "gramcheck-language-select";
        container.appendChild(select);

        this.languagePopup.appendChild(container);
        
        this.languageButton = this.createLanguageButton();
        
        // Populate the dropdown asynchronously
        this.populateLanguageList(select);

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
                --primary-color: #0078D4;
                --primary-color-hover: #006BBE;
                --error-color: #E81123;
                
                /* Light mode colors */
                --background-color: #ffffff;
                --secondary-background: #f5f5f5;
                --border-color: #ccc;
                --text-color: #333;
                --text-secondary: #666;
                --text-muted: #555;
                --shadow-color: rgba(0, 0, 0, 0.15);
            }

            @media (prefers-color-scheme: dark) {
                :root {
                    --background-color: #1e1e1e;
                    --secondary-background: #2d2d2d;
                    --border-color: #404040;
                    --text-color: #ffffff;
                    --text-secondary: #cccccc;
                    --text-muted: #999999;
                    --shadow-color: rgba(0, 0, 0, 0.3);
                }
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
                border-top: 2px solid var(--primary-color);
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
                text-decoration-color: var(--error-color);
                text-decoration-style: wavy;
                pointer-events: auto;
                cursor: pointer;
            }
            .gramcheck-error-popup {
                position: absolute;
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                box-shadow: 0px 2px 6px var(--shadow-color);
                z-index: 1000;
                display: none;
                min-width: 300px;
                max-width: 400px;
                font-family: var(--font-ui);
            }
            
            .gramcheck-error-popup-title {
                display: flex;
                align-items: center;
                background: var(--secondary-background);
                padding: 8px;
                border-bottom: 1px solid var(--border-color);
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
                color: var(--text-color);
            }
            
            .gramcheck-error-popup-close {
                background: none;
                border: none;
                font-size: 20px;
                color: var(--text-secondary);
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
                font-family: var(--font-system);
            }
            
            .gramcheck-error-popup-close:hover {
                color: var(--text-color);
            }
            
            .gramcheck-error-popup-content {
                padding: 12px;
            }
            
            .gramcheck-error-popup-error-title {
                font-weight: 600;
                font-size: 12px;
                color: var(--text-color);
                margin-bottom: 8px;
            }
            
            .gramcheck-error-popup-error-description {
                font-weight: 400;
                font-size: 14px;
                color: var(--text-secondary);
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
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 13px;
                line-height: 1.4;
            }
            
            .gramcheck-error-popup-suggestion:hover {
                background: var(--primary-color-hover);
            }
            .gramcheck-language-button {
                position: absolute;
                bottom: 10px;
                right: 10px;
                background: var(--primary-color);
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
                background: var(--error-color);
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
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                box-shadow: 0px 2px 6px var(--shadow-color);
                z-index: 1001;
                display: none;
                pointer-events: auto;
                min-width: 240px;
                font-family: var(--font-ui);
            }
            .gramcheck-language-container {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
            }
            .gramcheck-language-icon {
                flex-shrink: 0;
                width: 34px;
                height: 19px;
                color: #333; /* Default color for light mode */
            }
            @media (prefers-color-scheme: dark) {
                .gramcheck-language-icon {
                    color: #eee; /* Light color for dark mode */
                }
            }
            .gramcheck-language-select {
                flex: 1;
                padding: 4px 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 14px;
                font-family: var(--font-ui);
                cursor: pointer;
                background: white;
                color: #333;
            }
            @media (prefers-color-scheme: dark) {
                .gramcheck-language-select {
                    background: #333;
                    color: white;
                    border-color: #555;
                }
                .gramcheck-language-select:hover {
                    border-color: var(--primary-color);
                }
                .gramcheck-language-select option {
                    background: #333;
                    color: white;
                }
            }
            .gramcheck-language-select:hover {
                border-color: var(--primary-color);
            }
            .gramcheck-language-select:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.1);
            }
            .gramcheck-language-select option {
                padding: 4px;
                font-size: 14px;
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
                color: var(--primary-color);
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
                background: var(--secondary-background);
                color: var(--text-color);
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
                border-bottom: 1px solid var(--border-color);
            }
            .gramcheck-popup-logo {
                width: 24px;
                height: 24px;
                margin-right: 8px;
            }
            .gramcheck-popup-title-text {
                font-size: 14px;
                font-weight: 500;
                color: var(--text-color);
            }
            .gramcheck-popup-close {
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 20px;
                cursor: pointer;
                padding: 0 8px;
            }
            .gramcheck-popup-close:hover {
                color: var(--text-color);
            }
            .gramcheck-popup-content {
                padding: 8px;
                max-height: 200px;
                overflow-y: auto;
            }
            .gramcheck-popup-error-title {
                font-weight: 500;
                margin-bottom: 4px;
                color: var(--text-color);
            }
            .gramcheck-popup-error-description {
                margin-bottom: 8px;
                color: var(--text-secondary);
            }
        `;
    }

    private createLanguageButton(): HTMLButtonElement {
        const languageButton = document.createElement("button");
        languageButton.className = "gramcheck-language-button";
        languageButton.title = "Language Settings";
        return languageButton;
    }

    private async populateLanguageList(select: HTMLSelectElement): Promise<void> {
        try {
            const response = await apiRequestLanguageOptions();
            const availableLanguages = Object.entries(response.available.grammar).map(([code, name]): LanguageChoice => ({
                code,
                displayName: name
            }));
            
            // Clear existing options
            select.innerHTML = '';
            
            // Populate the dropdown
            availableLanguages.forEach(lang => {
                const option = document.createElement("option");
                option.value = lang.code;
                option.textContent = lang.displayName;
                option.selected = lang.code === this.currentLanguage;
                select.appendChild(option);
            });

            // Add change event listener
            select.addEventListener("change", () => {
                const selectedCode = select.value;
                this.currentLanguage = selectedCode;
                this.languagePopup.style.display = "none";
                
                // Start immediate grammar check
                this.startGrammarCheck(true);
            });
        } catch (error) {
            console.error("Failed to load available languages:", error);
        }
    }

    public handleLanguageSelect(langCode: string): void {
        this.currentLanguage = langCode;
        this.languagePopup.style.display = "none";
        
        // Start immediate grammar check
        this.startGrammarCheck(true);
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
        document.addEventListener("click", (event) => {
            // Don't close if clicking inside the language popup
            if (!this.languagePopup.contains(event.target as Node)) {
                this.languagePopup.style.display = "none";
            }

            // Close error popup if clicking outside the overlay
            if (!this.overlay.contains(event.target as Node)) {
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

    private startGrammarCheck(immediate: boolean = false): void {
        if (!this.currentTextarea) return;
        const text = this.currentTextarea.value;
            
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
        }, immediate ? 0 : 1000); // Immediate or 1 second delay
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
        
        // Set up input handler that triggers grammar check
        const handleInput = () => this.startGrammarCheck();

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

    public cleanup(): void {
        // Remove elements from DOM
        this.overlay.remove();
        this.popup.remove();
        this.languagePopup.remove();
        this.languageButton.remove();
        this.loadingSpinner.remove();

        // Clean up event listeners
        if (this.currentTextarea) {
            this.currentTextarea.removeEventListener('scroll', this.handleScroll);
            window.removeEventListener('scroll', () => this.updatePosition(this.currentTextarea!));
        }

        // Clear any pending timers
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // Clear error map
        this.errorMap.clear();
    }

}
