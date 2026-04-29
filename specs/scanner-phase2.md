# Spec: Scanner Phase 2

## Goal
Long-running Node.js daemon that scans Gmail 4x/day for GDP INITIAL LEAD emails, parses them with Claude (regex fallback), writes leads to Supabase, and notifies the team.

## Key decisions
- **Long-running daemon + node-cron** — scripts/run-scanner.ts stays running; node-cron fires at 7/11/14/16 ET. PM2 keeps it alive. Simpler than PM2 cron_restart.
- **Scanner uses relative imports only** — no `@/` path aliases; avoids tsconfig resolution issues with tsx.
- **Supabase writer uses service role key** — direct `createClient` from `@supabase/supabase-js`, not the Next.js cookie client. Bypasses RLS.
- **Gmail search** — single query `subject:"INITIAL LEAD" after:UNIX_TIMESTAMP` across all mail; dedup prevents double-processing if the same message appears in multiple labels.
- **Auth script** — `scripts/gmail-auth.ts` opens browser for OAuth2, prints refresh token for user to copy into .env. Run once with `npm run auth`.
- **dotenv** — scanner loads `.env` at startup since it's not a Next.js process.

## Files
- `src/lib/scanner/types.ts`
- `src/lib/scanner/dedup.ts`
- `src/lib/scanner/router.ts`
- `src/lib/scanner/parser.ts`
- `src/lib/scanner/gmail.ts`
- `src/lib/scanner/writer.ts`
- `src/lib/scanner/notify.ts`
- `src/lib/scanner/index.ts`
- `scripts/run-scanner.ts`
- `scripts/gmail-auth.ts`
- `ecosystem.config.js`
- `data/.gitkeep`
- `tests/unit/parser.test.ts`
- `tests/unit/router.test.ts`

## Done looks like
- `npm run auth` prints a URL, user authorizes, refresh token printed to console
- `npm run scan` runs one scan and exits (for manual testing)
- `node --loader tsx scripts/run-scanner.ts` (or PM2) stays running, fires scans on schedule
- Parser tests pass with sample GDP email
- Router tests pass for all 5 region rules
- All 74 existing tests still pass
