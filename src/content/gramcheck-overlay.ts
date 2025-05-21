// import { GrammarError } from "../types";

// export class GramCheckOverlay extends HTMLElement {
//   constructor() {
//     super();

//     // Attach Shadow DOM to this element
//     const shadow = this.attachShadow({ mode: "open" });

//     // Create a container for the overlay
//     const overlay = document.createElement("div");
//     overlay.setAttribute("class", "overlay");

//     // Add styles to the shadow DOM
//     const style = document.createElement("style");
//     style.textContent = `
//       .overlay {
//         position: absolute;
//         top: 0;
//         left: 0;
//         width: 100%;
//         height: 100%;
//         font-size: 16px;
//         line-height: 1.5;
//         white-space: pre-wrap;
//         //color: transparent;
//         background-color: rgba(0, 255, 0, 0.2);
//         pointer-events: none; /* Prevent interaction */
//       }
//       .error {
//         text-decoration: underline;
//         text-decoration-color: red;
//         text-decoration-style: wavy;
//         pointer-events: auto; /* Enable click events for errors */
//         cursor: pointer;
//       }
//       .popup {
//         position: absolute;
//         background: white;
//         border: 1px solid #ccc;
//         padding: 4px 8px;
//         box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.15);
//         z-index: 1000;
//         display: none;
//       }
//     `;
//     // Popup element
//     const popup = document.createElement("div");
//     popup.setAttribute("class", "popup");
//     popup.textContent = "Possible typo?";

//     // Append the overlay and styles to the Shadow DOM
//     shadow.appendChild(style);
//     shadow.appendChild(overlay);
//     shadow.appendChild(popup);

//     // Click handler for errors
//     overlay.addEventListener("click", (event: Event) => {
//         const targetElement = event.target as HTMLElement
//         if (!targetElement) return
//       if (targetElement.classList.contains("error")) {
//         console.log("ERROR CLICKED");
//         const rect = targetElement.getBoundingClientRect();
//         console.log(rect.top);
//         popup.style.left = `${rect.left}px`;
//         popup.style.top = `${rect.top - popup.offsetHeight - 5}px`;
//         popup.style.display = "block";
//       } else {
//         popup.style.display = "none";
//       }
//     });

//     // Hide popup when clicking outside
//     document.addEventListener("click", (event) => {
//         const targetElement = event.target as HTMLElement
//       console.log(targetElement);
//       if (!targetElement.classList.contains("error")) {
//         if (!shadow.contains(targetElement)) {
//           //popup.style.display = "none";
//         }
//       }
//     });
//   }

//   // Update the overlay with highlighted errors
//   updateOverlay(text: string, errors: GrammarError[]) {
//     if (!this || !this.shadowRoot) {
//         console.log("`this` or `this.shadowRoot` is null!")
//         return
//     }

//     const overlay = this.shadowRoot.querySelector(".overlay");
//     if (!overlay) {
//         console.log("overlay is null!")
//         return
//     }

//     let highlightedText = text;

//     // Wrap errors with <span class="error">
//     errors.reverse().forEach((error: GrammarError) => {
//       const before = highlightedText.slice(0, error.start);
//       const after = highlightedText.slice(error.end);
//       const errorWord = `<span class="error">${highlightedText.slice(
//         error.start,
//         error.end
//       )}</span>`;
//       highlightedText = before + errorWord + after;
//     });

//     // Set the content of the overlay
//     overlay.innerHTML = highlightedText.replace(/\n/g, "<br>");
//   }

//   updateOverlayPadding(textarea: HTMLTextAreaElement) {
//     if (!this || !this.shadowRoot) return 
//     const overlay: HTMLDivElement | null = this.shadowRoot.querySelector(".overlay");
//     if (!overlay) return

//     const textAreaStyle = window.getComputedStyle(textarea);
//     const paddingLeft = parseInt(textAreaStyle.paddingLeft);
//     const paddingRight = parseInt(textAreaStyle.paddingRight);
//     const paddingTop = parseInt(textAreaStyle.paddingTop);
//     const paddingBottom = parseInt(textAreaStyle.paddingBottom);
//     const borderLeft = parseInt(textAreaStyle.borderLeftWidth);
//     const borderRight = parseInt(textAreaStyle.borderRightWidth);
//     const borderTop = parseInt(textAreaStyle.borderTopWidth);
//     const borderBottom = parseInt(textAreaStyle.borderBottomWidth);
//     const rect = textarea.getBoundingClientRect();
//     overlay.style.padding = textAreaStyle.padding;
//     overlay.style.width = `${
//       rect.width - paddingLeft - paddingRight - borderLeft - borderRight
//     }px`;
//     overlay.style.height = `${
//       rect.height - paddingTop - paddingBottom - borderTop - borderBottom
//     }px`;
//   }
// }
