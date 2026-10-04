# Lumen — Expense Tracker

A modern personal finance dashboard built with React and Vite. Track income and expenses, explore monthly statistics, and see where your money goes. Sign in with email and password and your data syncs securely across devices through Supabase.

## Features

- **Accounts**: email + password sign-up and sign-in, password reset by email, sign out per device
- **Dashboard**: total balance, income, expenses and savings, a 6-month cash-flow chart, spending by category, recent transactions, budget progress and insights
- **Transactions**: add, edit and delete income or expenses with a name, amount, category, date and optional description; undo deletes; search, filter by type, category and month, sort, and export to CSV
- **Analytics**: monthly statistics, income vs. expenses, daily spending, category breakdown, largest expenses and a full month-by-month history
- **Settings**: display name, currency, opening balance and monthly budget (saved to your account); dark/light theme (saved per device); sample data and data management
- New accounts start empty, with an optional **Load sample data** button (sample rows are labeled and removable)
- One-time **import** of data saved in the browser by the pre-accounts version (the local copy is never deleted without confirmation)
- Loading, saving, error and offline states; saving requires an internet connection
- Fully responsive layout for desktop, tablet and mobile

## Tech stack

- [React](https://react.dev/) 19 + [Vite](https://vite.dev/) 8
- [Supabase](https://supabase.com/) for authentication (PKCE flow) and Postgres storage with Row Level Security
- [Recharts](https://recharts.org/) for charts, [Lucide](https://lucide.dev/) icons
- Plain CSS with custom properties (no UI framework)

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com/).
2. In **SQL Editor**, run [`supabase/migrations/20261003000000_accounts.sql`](supabase/migrations/20261003000000_accounts.sql). It creates the `profiles` and `transactions` tables, enables Row Level Security with owner-only policies, and creates a profile for each new user. It is safe to run more than once.
3. In **Authentication → URL Configuration**, set **Site URL** to your production URL (e.g. `https://your-app.vercel.app`) and add `http://localhost:5173/**` (and any preview URLs you use) to **Redirect URLs**.
4. In **Authentication → Providers → Email**, keep email sign-in enabled. "Confirm email" is recommended; set the minimum password length to 8.
5. Copy `.env.example` to `.env.local` and fill in your project URL and **publishable** (or anon) key from **Project Settings → API**. Add the same variables in Vercel → Project → Settings → Environment Variables.

> Never use the `service_role` / secret key in this app. It bypasses Row Level Security, and anything in a `VITE_` variable is shipped to every browser. The app refuses to start if it detects one.

## Getting started

Requires [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npm run dev
```

Then open http://localhost:5173. Without the environment variables the app shows a setup screen instead.

## Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start the development server             |
| `npm run build`      | Build for production into `dist/`        |
| `npm run preview`    | Preview the production build locally     |
| `npm test`           | Run the test suite once (Vitest + jsdom) |
| `npm run test:watch` | Re-run tests on file changes             |

## Testing

`src/test/` contains unit tests (formatting, statistics, demo data, CSV export, local-data import, the Supabase repository's queries and row mapping, and client configuration such as PKCE) and integration tests that render the full app with an in-memory backend and a fake auth client: sign-up, sign-in, password reset, sign-out, adding/editing/deleting transactions with every dashboard figure checked, failure and rollback handling, sample data, and the import flow.

## Project structure

```
src/
  components/   Reusable UI (sidebar, modal, charts, transaction list, import dialog, states)
  context/      Auth, theme and app data state
  data/         Supabase repository, local-data import, categories, demo data
  lib/          Supabase client setup
  pages/        Auth, Dashboard, Transactions, Analytics, Settings
  utils/        Formatting, statistics and CSV export helpers
supabase/
  migrations/   Database schema and Row Level Security policies
```

## Privacy & security

- Transactions and profile settings are stored in your Supabase project. Row Level Security ensures each account can only read and change its own rows; signed-out visitors have no access.
- The browser only ever holds the publishable key and the signed-in user's session.
- The theme preference stays on each device.
- Data saved by the pre-accounts version stays in that browser until you delete it in Settings. On a shared browser, once one account imports it, other accounts can't see or import it.
