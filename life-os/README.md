# Life OS

Life OS is a personal operating system built with React + Supabase to manage daily execution across tasks, goals, fitness, finance, and client/deal workflows.

It combines productivity tracking with analytics and gamification so progress feels like leveling up in a game.

## Screenshots

### Desktop View

![Life OS Desktop](./docs/screenshots/desktop-auth.png)

### Mobile View

![Life OS Mobile](./docs/screenshots/mobile-auth.png)

## Core Modules

- Tasks board with filters, due dates, and priorities
- Goals planner with milestones, ordering, and progress visuals
- Fitness tracker with workouts, exercises, sets, and progression charts
- Finance tracker with accounts, categories, transactions, monthly analytics
- CRM workspace with client directory, client detail, and deals Kanban
- Command Center dashboard with live widgets (agenda, training, spending)
- Gamification layer with XP, levels, streaks, and level-up modal

## Tech Stack

- Frontend: React 19, React Router 7, Vite
- Backend: Supabase (Postgres, Auth, RLS)
- Drag and drop: dnd-kit
- Charts: Recharts
- Styling: custom CSS

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env variables in `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

3. Start development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Supabase SQL Migration Order

Run these scripts in order from the repository root `supabase/` folder:

1. `001_auth_profile_setup.sql`
2. `002_tasks_rls.sql`
3. `003_fitness_rls.sql`
4. `004_fitness_select_options.sql`
5. `005_goals_milestones_rls.sql`
6. `006_milestone_ordering.sql`
7. `007_goal_auto_status.sql`
8. `008_finance_rls.sql`
9. `009_crm_rls.sql`
10. `010_gamification.sql`
11. `011_deals_won_to_finance.sql`
12. `012_clients_phone_city.sql`
13. `013_deals_won_sync_fix.sql`

## Notable Features by Milestone

### Milestone 1: CRM Foundation

- Client directory and client detail pages
- Deals pipeline with drag-and-drop stages
- Mobile quick-add modals for leads and deals

### Milestone 2: Progress & Analytics

- Fitness line chart for weight progression
- Finance monthly income vs expense chart
- Net worth ticker and goal completion circles

### Milestone 3: Command Center Dashboard

- Today's agenda widget (todo tasks due today)
- Daily training widget (today's workout or plan CTA)
- Finance snapshot widget (7-day spending)

### Milestone 4: Gamification & Polish

- XP gain when completing tasks (priority-weighted)
- Level system with thresholds and global level-up modal
- Consecutive activity streak display on dashboard
- Mobile polish across widgets, modals, and charts

## Deployment

The project is configured for Vercel from repo root (`vercel.json`) with SPA rewrite support.

Required env vars in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
