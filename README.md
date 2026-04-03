# QC Estimator

Internal pricing and estimate builder for QC Event Design.

## Status
🟡 In Development — Phase 1

## Overview

QC Estimator replaces a 30+ tab Excel workbook with a web application for pricing corporate events. The team selects a location, enters venue-specific line items, and the app automatically applies category markups, multi-rate taxes, restaurant fees, commissions, and generates margin analysis — all without touching a formula.

The tool supports multi-scenario comparison (price 4 restaurants against each other for the same event) and exports clean per-person breakdowns for the team's Canva proposal workflow.

Built for a non-technical team. No SQL, no formulas, no spreadsheet architecture knowledge required.

## Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** Supabase (Postgres + Auth + RLS)
- **Styling:** Tailwind CSS
- **Testing:** Vitest
- **Deployment:** Vercel

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase account (free tier works for development)

### Installation
```bash
# Clone the repo
git clone <repo-url>
cd qc-estimator

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### Running
```bash
# Development server
npm run dev

# Open http://localhost:3000
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run pricing engine tests only
npm test -- --grep "engine"
```

## Project Structure

See `CLAUDE.md` for full directory layout and coding standards.

Key directories:
- `src/lib/engine/` — Pure TypeScript pricing calculation engine (framework-agnostic, 100% test coverage required)
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — React components organized by domain
- `supabase/` — Database migrations and seed data

## Contributing

This is an internal tool built by Gary Stack (Stack Industries LLC) with Claude Code. See `CLAUDE.md` for coding standards and session protocol.

## License

Private — QC Event Design / Stack Industries LLC
