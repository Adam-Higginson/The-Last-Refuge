// env.d.ts — Global type declarations for Vite-injected constants.

/** Build timestamp injected by Vite at build/serve time. */
declare const __BUILD_TIME__: string;

/** Extiris API key injected at build time from VITE_EXTIRIS_API_KEY env variable. */
declare const __EXTIRIS_API_KEY__: string;
