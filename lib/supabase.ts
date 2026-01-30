
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Primary Auth Database (Nexus Global)
const GLOBAL_URL = import.meta.env.VITE_SUPABASE_GLOBAL_URL;
const GLOBAL_KEY = import.meta.env.VITE_SUPABASE_GLOBAL_KEY;

// Export a helper to check if Auth is configured
export const isAuthReady = !!(GLOBAL_URL && GLOBAL_KEY);

// Create the client only if the URL is provided to avoid crashing on module load
export const authSupabase = isAuthReady
  ? createClient(GLOBAL_URL!, GLOBAL_KEY!)
  : null as unknown as SupabaseClient;

// Secondary Library Database (User Personal)
let libraryInstance: SupabaseClient | null = null;

export const getLibraryClient = (): SupabaseClient | null => {
  return libraryInstance;
};

export const initLibraryClient = (url: string, key: string) => {
  try {
    if (!url || !key) return null;
    libraryInstance = createClient(url, key);
    return libraryInstance;
  } catch (e) {
    console.error("Failed to initialize Library client", e);
    return null;
  }
};

export const clearLibraryClient = () => {
  libraryInstance = null;
};

export const PRIMARY_SCHEMA = `
-- ==========================================
-- RUN THIS IN YOUR PRIMARY (GLOBAL) SUPABASE PROJECT
-- ==========================================

-- 1. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  library_url TEXT,
  library_key TEXT,
  login_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Security: Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Row Level Security policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (true);

-- 5. Share links table (public access, no auth required)
CREATE TABLE IF NOT EXISTS public.share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  papers JSONB NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_share_links_share_id ON public.share_links(share_id);
CREATE INDEX IF NOT EXISTS idx_share_links_created_by ON public.share_links(created_by);

-- Allow public read access to share_links
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view share links" ON public.share_links
  FOR SELECT USING (true);

CREATE POLICY "Users can create share links" ON public.share_links
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own share links" ON public.share_links
  FOR UPDATE USING (created_by IN (SELECT id FROM public.profiles));

CREATE POLICY "Users can delete their own share links" ON public.share_links
  FOR DELETE USING (created_by IN (SELECT id FROM public.profiles));

-- 6. RPC: signup_user
CREATE OR REPLACE FUNCTION public.signup_user(p_username TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
    new_profile public.profiles;
BEGIN
    INSERT INTO public.profiles (username, password_hash)
    VALUES (p_username, crypt(p_password, gen_salt('bf', 10)))
    RETURNING * INTO new_profile;

    RETURN jsonb_build_object(
        'id', new_profile.id,
        'username', new_profile.username,
        'library_url', new_profile.library_url,
        'library_key', new_profile.library_key
    );
EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Username already taken.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: signin_user
CREATE OR REPLACE FUNCTION public.signin_user(p_username TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
    v_profile public.profiles;
    v_cooldown INTEGER;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE username = p_username;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid credentials.';
    END IF;

    -- Basic brute force protection
    v_cooldown := CASE WHEN v_profile.login_attempts < 3 THEN 0 ELSE 30 END;
    IF v_profile.last_attempt_at > NOW() - (v_cooldown * INTERVAL '1 second') THEN
        RAISE EXCEPTION 'Locked. Wait % seconds.', v_cooldown;
    END IF;

    IF v_profile.password_hash = crypt(p_password, v_profile.password_hash) THEN
        UPDATE public.profiles SET login_attempts = 0, last_attempt_at = NOW() WHERE id = v_profile.id;
        RETURN jsonb_build_object(
            'id', v_profile.id,
            'username', v_profile.username,
            'library_url', v_profile.library_url,
            'library_key', v_profile.library_key
        );
    ELSE
        UPDATE public.profiles SET login_attempts = login_attempts + 1, last_attempt_at = NOW() WHERE id = v_profile.id;
        RAISE EXCEPTION 'Invalid credentials.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: update_profile (CRITICAL: Required for Setup page)
CREATE OR REPLACE FUNCTION public.update_profile(p_user_id UUID, p_url TEXT, p_key TEXT)
RETURNS JSONB AS $$
DECLARE
    u_profile public.profiles;
BEGIN
    UPDATE public.profiles 
    SET library_url = p_url, 
        library_key = p_key,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING * INTO u_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found.';
    END IF;

    RETURN jsonb_build_object(
        'id', u_profile.id,
        'username', u_profile.username,
        'library_url', u_profile.library_url,
        'library_key', u_profile.library_key
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

export const LIBRARY_SCHEMA = `
-- Run this in your PERSONAL Library Supabase project
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  pdf_link TEXT,
  doi TEXT,
  authors TEXT,
  published_year TEXT,
  summary TEXT,
  abstract TEXT,
  user_label TEXT,
  importance INTEGER DEFAULT 0,
  critical_evaluation TEXT,
  remarks TEXT,
  useful_snippet TEXT,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('web', 'pdf')) DEFAULT 'web',
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;
