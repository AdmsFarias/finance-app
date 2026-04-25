declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly API_INTERNAL_URL: string;
    readonly NEXT_PUBLIC_DEFAULT_LOCALE: 'pt-BR' | 'en-US' | 'es-ES';
    readonly NEXT_PUBLIC_SUPPORTED_LOCALES: string;
  }
}
