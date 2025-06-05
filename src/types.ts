export type GrammarError = {
  word: string;
  start: number;
  end: number;
};

export const PAGE_SCRIPT_READY = "PAGE_SCRIPT_READY";

// Interface for interacting with the page script from the content script
export interface PageScriptInterface {
  createOverlay: (id: string, styles?: Partial<CSSStyleDeclaration>) => void;
  updateOverlay: (id: string, text: string, errors: GrammarError[]) => void;
  updatePadding: (overlayId: string, textareaId: string) => void;
}

export type PageScriptCommand = 
| {
  type: "createOverlay";
  args: {
    id: string;
    styles?: Partial<CSSStyleDeclaration>;
  }
}
| {
  type: "updateOverlay";
  args: {
    id: string;
    text: string;
    errors: GrammarError[];
  }
}
| {
  type: "updatePadding";
  args: {
    overlayId: string;
    textareaId: string;
  }
};