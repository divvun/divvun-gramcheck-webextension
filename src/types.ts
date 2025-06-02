export type GrammarError = {
  word: string;
  start: number;
  end: number;
};

export interface GramCheckInterface {
  createOverlay: (id: string, styles?: Partial<CSSStyleDeclaration>) => string;
  updateOverlay: (id: string, text: string, errors: GrammarError[]) => void;
  updatePadding: (overlayId: string, textareaId: string) => void;
}
