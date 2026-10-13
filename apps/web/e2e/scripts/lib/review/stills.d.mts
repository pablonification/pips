// Types for stills.mjs.
export declare const STILL_NAMES: Record<string, RegExp>;
export declare function parseStill(source: string, file: string): { layout: string; state: string; theme: string } | null;
