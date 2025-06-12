// Pulled from https://github.com/divvun/divvun-gramcheck-web/

// import 'whatwg-fetch';
import { APIGrammarError } from './api';

export const IGNORED_ERROR_TAGS_KEY = 'ignoredErrorTags';
export const SELECTED_LANGUAGE_KEY = 'selectedLanguage';
export const IGNORED_ERRORS_KEY = 'ignoredIndividualErrors';

export function clipToErrorContext(parargaph: string, errorText: string, errorOffset: number): string {
    const errorTextPos = parargaph.indexOf(errorText, errorOffset);
  
    if (errorTextPos > -1) {
        let cutStartIndex = parargaph.substr(0, errorTextPos - 1).lastIndexOf(' ');
        if (cutStartIndex < 0) {
            cutStartIndex = 0;
        }
        let cutEndIndex = parargaph.indexOf(' ', errorTextPos + errorText.length + 1);
        if (cutEndIndex < 0) {
            cutEndIndex = parargaph.length;
        }
        return parargaph.substr(cutStartIndex, cutEndIndex - cutStartIndex);
    }
    return parargaph;
  }
   


export function splitInParagraphs(text: string): string[] {
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalizedText.split('\n');
}

export function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isInvalidSearchCharacter(char: string): boolean {
    const code = char.charCodeAt(0);
    return (code >= 0 && code <= 0x1F) || code === 0x7f || (code >= 0x80 && code <= 0x9F);
}

function splitStringToChunks(string: string, chunkLength: number, errorOffset: number): string[] {
    const chunks: string[] = [];

    let tempString: string = '';
    let counter: number = 1;
    for (const char of string.substring(errorOffset)) {
        const invalidChar = isInvalidSearchCharacter(char);
        if (counter > chunkLength || (counter > 0 && invalidChar)) {
            chunks.push(tempString);
            tempString = '';
            counter = 1;
        }
        if (!invalidChar) {
            tempString += char;
            counter++;
        }
    }

    chunks.push(tempString);

    return chunks;
}

export function loadSettings(key: string): string | null {
    return localStorage.getItem(key);
}

export function saveSettings(key: string, value: string) {
    localStorage.setItem(key, value);
}

export function filterIgnoredErrorTags(grammarErrors: APIGrammarError[]): APIGrammarError[] {
    return grammarErrors.filter((e) => !isErrorTagIgnored(e));
}

export function filterIgnoredIndividualErrors(grammarErrors: APIGrammarError[]): APIGrammarError[] {
    return grammarErrors.filter((e) => !isIndividualErrorIgnored(e));
}

function isErrorTagIgnored(error: APIGrammarError): boolean {
    const savedIgnoredErrorTags = loadIgnoredErrorTags();

    return savedIgnoredErrorTags.indexOf(error.error_code) > -1;
}

function loadIgnoredErrorTags(): string[] {
    let savedIgnoredErrorTags = loadSettings(IGNORED_ERROR_TAGS_KEY);
    if (!savedIgnoredErrorTags) {
        return [];
    }

    let errors: string[] = [];
    try {
        errors = savedIgnoredErrorTags.split(',');
    } catch (e) {
        console.error('Error parsing saved ignored error tags', e);
    } finally {
        return errors;
    }
}

export function ignoreIndividualError(error: APIGrammarError) {
    const savedIgnoredErrors = loadIgnoredIndividualErrors();

    savedIgnoredErrors.push(serializeError(error));

    try {
        saveSettings(IGNORED_ERRORS_KEY, savedIgnoredErrors.join(','));
    } catch (e) {
        console.error('Error saving ignored errors', e);
    }
}

function loadIgnoredIndividualErrors(): string[] {
    let savedIgnoredErrors = loadSettings(IGNORED_ERRORS_KEY);
    if (!savedIgnoredErrors) {
        return [];
    }

    let errors: string[] = [];
    try {
        errors = savedIgnoredErrors.split(',');
    } catch (e) {
        console.error('Error parsing saved ignored errors', e);
    } finally {
        return errors;
    }
}

function isIndividualErrorIgnored(error: APIGrammarError): boolean {
    const savedIgnoredErrors = loadIgnoredIndividualErrors();

    return savedIgnoredErrors.indexOf(serializeError(error)) > -1;
}

function serializeError(error: APIGrammarError): string {
    return error.error_code + ':' +
        error.start_index + ':' +
        error.end_index + ':' +
        error.error_text.replace(/[,:+]/g, '');
}
