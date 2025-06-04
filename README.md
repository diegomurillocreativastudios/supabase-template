Setup 1. Install Next.js

npx create-next-app@latest my-app

    2.	Install Supabase Client

cd my-app
npm install @supabase/supabase-js

    3.	Create Environment File

touch .env.local

Luego, dentro de .env.local, agrega tus credenciales:

NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
