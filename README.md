# BRUTAL NOISE — NEURAL AUDIO 2050

**888 DIGITAL FACTORY / Music · AI · Community**

Cyberpunk music community frontend with Supabase authentication, persistent posts and media storage.

## Supabase setup
1. Open your Supabase project SQL Editor.
2. Run the complete script in `supabase/schema.sql`.
3. In Authentication → URL Configuration, add `https://rodrodbeat-stack.github.io/BrutalNoise-/` to the allowed redirect URLs.
4. In Authentication → Providers, enable Email. For a quick test, email confirmation can be disabled temporarily; for production, keep it enabled and configure SMTP.
5. The browser uses the publishable key in `js/supabase-config.js`. This key is intended to be public; RLS policies protect database and storage access.

## Connected features
- Email/password sign-up, sign-in and sign-out.
- Persistent community posts.
- Image, video and audio uploads to the `neural-media` Storage bucket (one attachment per post, maximum 100 MB).
- Public feed and live refresh of new posts through Supabase Realtime.
- RLS policies for profiles, posts, comments, likes, follows, chat and storage.

## Security
Never put a Supabase secret/service-role key in this repository. The publishable key is designed for browser use and must be paired with the included RLS policies.

The local sequencer and playlists remain browser-local in this iteration.

## GitHub Pages
Settings → Pages → Deploy from a branch → `main` → `/(root)`.
