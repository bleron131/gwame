/// <reference types="vite/client" />

interface ImportMetaEnv {
  // "browser" = GitHub-Pages-Version (Datenbank im Browser)
  readonly VITE_SPEICHER?: string;
}

declare module '*.sql?raw' {
  const inhalt: string;
  export default inhalt;
}
