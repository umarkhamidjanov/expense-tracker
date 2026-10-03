# Lumen — Expense Tracker

A modern personal finance dashboard built with React and Vite. Track income and expenses, explore monthly statistics, and see where your money goes, all stored locally in your browser.

## Features

- **Dashboard**: total balance, income, expenses and savings, a 6-month cash-flow chart, spending by category, recent transactions, budget progress and insights
- **Transactions**: add, edit and delete income or expenses with category, description and date; search, filter by type, category and month, sort, and export to CSV
- **Analytics**: monthly statistics, income vs. expenses, daily spending, category breakdown, largest expenses and a full month-by-month history
- **Settings**: display name, dark/light theme, currency, opening balance, monthly budget, and data management
- Realistic demo data on first load
- Data persists in `localStorage`, with no backend or account needed
- Fully responsive layout for desktop, tablet and mobile (bottom navigation and bottom-sheet forms on phones)

## Tech stack

- [React](https://react.dev/) 19 + [Vite](https://vite.dev/) 8
- [Recharts](https://recharts.org/) for charts
- [Lucide](https://lucide.dev/) icons
- Plain CSS with custom properties (no UI framework)

## Getting started

Requires [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start the development server             |
| `npm run build`   | Build for production into `dist/`        |
| `npm run preview` | Preview the production build locally     |

## Project structure

```
src/
  components/   Reusable UI (sidebar, modal, charts, transaction list, …)
  context/      App state and localStorage persistence
  data/         Categories and demo data generator
  pages/        Dashboard, Transactions, Analytics, Settings
  utils/        Formatting, statistics and CSV export helpers
```

## Privacy

All data stays on your device in the browser's `localStorage`. Nothing is sent to a server.
