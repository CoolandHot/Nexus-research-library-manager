/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_GLOBAL_URL: string
    readonly VITE_SUPABASE_GLOBAL_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
