# CLAUDE.md — Rekindle

## What is this?
**Rekindle** is a social events app where users swipe on local events (Tinder-style), get matched into group chat rooms with other attendees, and connect before the event. An AI bot called **Rekindled AI** keeps conversations alive with playful "rage bait" hot takes.

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — auth, database, edge functions, realtime
- **AI:** Lovable AI Gateway (`ai.gateway.lovable.dev`) using `google/gemini-3-flash-preview`
- **Animations:** Framer Motion
- **Fonts:** Playfair Display (display) + DM Sans (body)

## Project Structure
```
src/
├── pages/           # Route-level components
│   ├── Landing.tsx   # Marketing page (/)
│   ├── Signup.tsx    # Phone sign-up (/signup)
│   ├── Interests.tsx # Onboarding interest picker (/interests)
│   ├── Feed.tsx      # Swipeable event cards (/feed)
│   ├── Rooms.tsx     # Matched chat rooms list (/rooms)
│   ├── Chat.tsx      # Chat room with AI (/chat/:roomId)
│   └── Profile.tsx   # User profile (/profile)
├── components/
│   ├── chat/         # MentionInput, MessageBubble
│   ├── landing/      # Hero, CTA, Pricing, Story, Testimonials, Footer, Nav
│   ├── ui/           # shadcn/ui primitives (DO NOT manually edit)
│   ├── AppShell.tsx  # Layout wrapper with bottom nav
│   ├── EventCard.tsx # Swipeable event card
│   ├── SwipeCard.tsx # Tinder-style swipe gesture
│   └── SplashScreen.tsx
├── data/             # Mock data (mockEvents, mockRooms)
├── integrations/supabase/  # Auto-generated client & types (DO NOT edit)
└── hooks/            # use-mobile, use-toast
supabase/
├── functions/
│   ├── chat-ai/      # Edge function: AI rage-bait responses
│   └── matchmaking/  # Edge function: room matching logic
└── config.toml       # Auto-managed (DO NOT edit)
```

## Database Schema (Supabase)
| Table | Purpose |
|-------|---------|
| `profiles` | User info (name, avatar, email, phone) — references `auth.users(id)` |
| `user_interests` | User ↔ interest mapping |
| `swipes` | Event swipe records (direction: left/right) |
| `rooms` | Chat rooms tied to events |
| `room_users` | Room membership (user ↔ room) |
| `messages` | Chat messages with `is_ai` flag, realtime enabled |

### Key DB Function
- `user_is_room_member(_room_id, _user_id)` — SECURITY DEFINER function used in RLS policies

## Design System
- **Theme:** Light mode with warm, editorial aesthetic
- **Colors:** All HSL via CSS custom properties in `index.css`
  - `--background: 40 20% 98%` (warm off-white)
  - `--primary: 220 20% 8%` (near-black)
  - `--accent: 14 80% 50%` (coral/orange)
- **Shadows:** `--shadow-card`, `--shadow-elevated`, `--shadow-dramatic`
- **Border radius:** `--radius: 1rem`
- **Rule:** Never use raw color classes in components — always use semantic tokens (`bg-background`, `text-foreground`, `text-accent`, etc.)

## Critical Rules
1. **Never edit auto-generated files:** `client.ts`, `types.ts`, `config.toml`, `.env`
2. **Never store roles on profiles** — use a separate `user_roles` table
3. **Never use anonymous signups** — always require email verification
4. **Use semantic Tailwind tokens** — no hardcoded colors in components
5. **Edge functions deploy automatically** — no manual deploy needed
6. **Supabase client import:** `import { supabase } from "@/integrations/supabase/client"`
7. **RLS is enabled on all tables** — check policies before adding new queries

## Chat System Details
- Messages persist in `public.messages` table with realtime via `supabase_realtime` publication
- **Rekindled AI** auto-responds after every user message via the `chat-ai` edge function
- The AI uses recent message context + event title to generate contextual rage-bait
- `MentionInput` supports `@` mentions for room members and AI
- `MessageBubble` renders with distinct styling for user/other/AI messages

## Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run test     # Run vitest
npm run lint     # ESLint
```
