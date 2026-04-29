# PRD: QCED Lead-to-Contract Pipeline

## Document Info

- **Author:** Gary Stack
- **Created:** 2026-04-28
- **Status:** Draft
- **Last Updated:** 2026-04-28
- **Project:** qc-estimator (existing repo, new feature)

-----

## Problem Statement

QC Event Design's lead pipeline is broken across three disconnected systems. GDP lead emails arrive in Gmail, get unreliably parsed by a Google Apps Script into a Google Sheet, and are manually pushed into ClickUp. The team doesn't trust ClickUp for leads and the scanner keeps breaking. Leads that survive the pipeline then have to be manually re-entered into the qc-estimator to build proposals. The team wants leads to live inside the estimator app so they can work the entire lifecycle — from lead arrival to signed contract — in one place without re-typing data.

## Target User

The QC Event Design operations team (Alex, Lindsey, Lydia) who need leads to land automatically in the estimator, convert to programs/estimates without re-entering data, and track through the full sales cycle.

## Success Metrics

|Metric                                 |Target                                        |
|---------------------------------------|----------------------------------------------|
|Leads parsed and delivered to estimator|99%+ of valid GDP leads                       |
|Scanner uptime                         |No missed scan windows for 30 consecutive days|
|Data re-entry from lead to program     |Zero fields manually retyped                  |
|Time from email received to lead in app|< 15 minutes (next scan cycle)                |
|ClickUp usage for leads                |Fully eliminated                              |

-----

## Competitive Landscape

Not applicable — internal tool. Curate ($125–333/mo) is the closest commercial competitor but doesn't support QCED's pricing model and has no automated email-based lead intake. The estimator's pricing engine is the moat. See research brief for full landscape analysis.

-----

## MVP Scope — What's In

### Feature 1: Leads Table (Supabase)

- **Description:** New `leads` table storing all parsed lead data with lifecycle status tracking.
- **User story:** As an ops team member, I want all lead information stored in one place so I can access it alongside estimates.
- **Acceptance criteria:**
  - [ ] Migration creates `leads` table with all GDP fields: client_name, end_company, contact_name, contact_email, contact_role, third_party_company, third_party_contact, third_party_comm_notes, program_name, program_type, program_description, start_date, end_date, rain_date, num_nights, guest_count, city, state, hotel, venue, region, lead_source, source_advisor, source_coordinator, source_commission, third_party_commission, commission_notes, billing_notes, returning_client, special_instructions
  - [ ] System fields: assigned_to (text name), suggested_owner (text), original_email_link, parsed_by ('claude' or 'regex'), scan_batch_id, organization_id (nullable, for future white-label)
  - [ ] Status field with values: new_lead, proposal, under_contract, archived
  - [ ] Timestamps: created_at, updated_at, archived_at
  - [ ] RLS policies for authenticated users
  - [ ] Existing `programs` table gets a nullable `lead_id` FK referencing leads
- **Priority:** Must-have

### Feature 2: Leads List Page

- **Description:** New page in the estimator showing all leads in a sortable, filterable table.
- **User story:** As an ops team member, I want to see all my leads at a glance so I can prioritize and work them.
- **Acceptance criteria:**
  - [ ] Accessible from main navigation
  - [ ] Table columns: client name, program name, region, guest count, start date, assigned owner, status, created date
  - [ ] Sortable by any column
  - [ ] Filterable by status (New Lead, Proposal, Under Contract, Archived)
  - [ ] Filterable by assigned owner
  - [ ] Click a row to open lead detail
  - [ ] "Add Lead" button for manual entry (not every lead comes from the scanner)
  - [ ] Visual indicator for new leads (arrived today)
  - [ ] Count badges per status (e.g., "New Lead (3)")
- **Priority:** Must-have

### Feature 3: Lead Detail Page

- **Description:** Detail view of a single lead showing all parsed fields, with inline editing and the ability to create a program from the lead.
- **User story:** As an ops team member, I want to see all the details of a lead and fix any parsing errors before creating a program.
- **Acceptance criteria:**
  - [ ] Displays all parsed fields organized in logical sections: Client Info, Program Details, Dates & Logistics, Location, Source & Commission, Notes
  - [ ] All fields are inline-editable
  - [ ] Status dropdown to change lifecycle stage
  - [ ] Assigned owner dropdown (populated from team members)
  - [ ] "Create Program" button that creates a new program linked to this lead, pre-populating: program name, client name, start/end dates, guest count, venue, city/state, commission fields
  - [ ] If a program already exists for this lead, show a link to it instead of the create button
  - [ ] Link to original email (opens in Gmail)
  - [ ] Shows which parsing method was used (Claude vs regex)
  - [ ] Delete/archive lead option
- **Priority:** Must-have

### Feature 4: Lead-to-Program Linking

- **Description:** When creating a program from a lead, relevant fields auto-populate and the program stays linked to its source lead.
- **User story:** As an ops team member, I want to create a program from a lead without retyping any information.
- **Acceptance criteria:**
  - [ ] "Create Program" from lead detail pre-fills: program name, client (if client exists or creates new), event dates, guest count, venue, city, state
  - [ ] Program record stores lead_id FK
  - [ ] Lead status automatically moves to "proposal" when a program is created from it
  - [ ] From the program view, a link back to the source lead is visible
  - [ ] If the lead has source_commission or third_party_commission, those carry into the program's commission fields
- **Priority:** Must-have

### Feature 5: Region Router

- **Description:** Auto-suggests a lead owner based on the parsed region/market field.
- **User story:** As an ops team member, I want leads pre-assigned to the right person so triage is faster.
- **Acceptance criteria:**
  - [ ] Charlotte and North Carolina → Alex
  - [ ] DC, Maryland, and Virginia → Lindsey
  - [ ] Georgia → Lydia
  - [ ] New York and Philadelphia → Lindsey
  - [ ] Unknown/unmatched regions → no assignment (left for team to set)
  - [ ] Routing map stored in a config file or admin-editable reference table, not hardcoded in logic
- **Priority:** Must-have

### Feature 6: Gmail Scanner

- **Description:** Scans Gmail inbox and four labels for GDP INITIAL LEAD emails. Runs 4x/day via PM2 on the team's Mac.
- **User story:** As an ops team member, I want lead emails to be automatically detected so I don't have to manually check Gmail.
- **Acceptance criteria:**
  - [ ] Authenticates with Gmail API using persisted OAuth2 refresh token
  - [ ] Searches Inbox + four labeled folders (To Respond, FYI, Actioned, Notification)
  - [ ] Matches only GDP INITIAL LEAD formatted emails
  - [ ] Extracts full email body for each matched message
  - [ ] Tracks processed message IDs in a local JSON file to prevent duplicates
  - [ ] Rolling window: retains last 500 message IDs, prunes older entries
  - [ ] Runs on cron schedule: 7:00, 11:00, 14:00, 16:00 ET
  - [ ] Each scan covers previous 4 hours of email
  - [ ] Logs: start time, emails found, emails parsed, leads created, errors
- **Priority:** Must-have

### Feature 7: Lead Parser

- **Description:** Parses each matched email into structured lead fields using Claude API with regex fallback.
- **User story:** As an ops team member, I want lead emails to be automatically parsed into clean data.
- **Acceptance criteria:**
  - [ ] Sends email body to Claude API with structured extraction prompt
  - [ ] Extracts all fields listed in Feature 1
  - [ ] Falls back to regex parsing if Claude API call fails
  - [ ] Validates parsed output against a Zod schema (required fields present, dates parseable, numbers numeric)
  - [ ] Logs parsing method used and any validation warnings
- **Priority:** Must-have

### Feature 8: Supabase Lead Writer

- **Description:** Writes parsed leads directly to the leads table in Supabase.
- **User story:** As an ops team member, I want parsed leads to appear in the estimator automatically.
- **Acceptance criteria:**
  - [ ] Inserts parsed lead as a new row in the leads table with status = 'new_lead'
  - [ ] Sets suggested_owner based on region router
  - [ ] Stores original email link for reference
  - [ ] Records parsing method (claude or regex)
  - [ ] Records scan_batch_id for traceability
  - [ ] Uses Supabase service role key for scanner writes (bypasses RLS)
- **Priority:** Must-have

### Feature 9: Notification Email

- **Description:** Sends a summary email to the team after each scan.
- **User story:** As an ops team member, I want to know when new leads arrive so I can work them promptly.
- **Acceptance criteria:**
  - [ ] Sends via Gmail API (same OAuth credentials as scanner)
  - [ ] Includes: number of new leads found, client names, and a direct link to the leads list page in the estimator
  - [ ] Does not send if zero leads were found
  - [ ] Recipients configurable in .env
- **Priority:** Must-have

### Feature 10: Error Handling & Logging

- **Description:** Comprehensive error handling with PM2-compatible logging and failure alerts.
- **User story:** As the system maintainer, I want clear logs and failure alerts so I can diagnose issues quickly.
- **Acceptance criteria:**
  - [ ] All scanner operations wrapped in try/catch with structured error logging
  - [ ] Logs written to stdout/stderr (PM2 captures to files)
  - [ ] On scanner failure (auth error, API timeout), sends alert email to Gary
  - [ ] On Claude API failure, falls back to regex and logs the fallback
  - [ ] PM2 auto-restarts the process on crash
- **Priority:** Must-have

### Feature 11: PM2 Deployment on Mac

- **Description:** PM2 configuration and setup for running the scanner on the team's Mac.
- **User story:** As the maintainer, I want to deploy the scanner on my wife's Mac and have it survive reboots.
- **Acceptance criteria:**
  - [ ] ecosystem.config.js at project root with cron schedule, log rotation, auto-restart
  - [ ] PM2 startup configured to survive Mac reboots
  - [ ] `npm run auth` command handles one-time Gmail OAuth flow (opens browser, saves refresh token)
  - [ ] `.env.example` updated with all new scanner-specific variables
  - [ ] README section with step-by-step Mac setup instructions
  - [ ] Scanner entry point at `scripts/run-scanner.ts` (runs via tsx)
- **Priority:** Must-have

-----

## MVP Scope — What's NOT In

|Feature                               |Deferred To|Reason                                                         |
|--------------------------------------|-----------|---------------------------------------------------------------|
|Client response thread tracking       |Phase 2    |Different logic, not needed for lead intake                    |
|Proposal send detection               |Phase 2    |Requires outbound email tracking                               |
|Follow-up counting                    |Phase 2    |Depends on thread tracking                                     |
|Lead → confirmed program detection    |Phase 2    |Requires ClickUp or external status monitoring                 |
|Google Sheet review step              |Never      |Not in the original process, adds unnecessary friction         |
|Review mode / auto mode toggle        |Never      |Leads go straight to Supabase, team reviews in app             |
|ClickUp integration                   |Never      |ClickUp is out for leads                                       |
|Client-facing portal                  |Never      |Internal tool                                                  |
|Email thread display in app           |Never      |This is not a CRM                                              |
|Activity logging / follow-up reminders|Never      |This is not a CRM                                              |
|Multi-tenant / white-label features   |Phase 3+   |Add organization_id column now but don't build tenant isolation|
|Kanban board for lead stages          |Phase 2    |Nice-to-have but table view is sufficient for v1               |
|Mobile-optimized leads UI             |Phase 2    |Desktop first, same as estimator                               |

-----

## Technical Approach

### Architecture

Scanner lives inside qc-estimator as a module. One repo, shared types, two deployment targets.

```
Gmail (GDP emails)
    │
    │  polls 4x/day
    ▼
┌──────────────────┐
│  Scanner Module   │  ← runs via PM2 on Mac
│  src/lib/scanner/ │
└────────┬─────────┘
         │ parsed leads
         ▼
┌──────────────────┐
│    Supabase      │  ← shared with estimator
│   leads table    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Estimator UI    │  ← runs on Vercel
│  Leads List      │
│  Lead Detail     │
│  Create Program  │
└──────────────────┘
```

### New Files

```
qc-estimator/
├── src/
│   ├── app/
│   │   └── (programs)/
│   │       └── leads/
│   │           ├── page.tsx              # Leads list page
│   │           ├── actions.ts            # Lead CRUD + createProgramFromLead
│   │           └── [id]/
│   │               └── page.tsx          # Lead detail page
│   ├── lib/
│   │   └── scanner/
│   │       ├── index.ts              # Scanner entry point + cron schedule
│   │       ├── gmail.ts              # Gmail API scan logic
│   │       ├── parser.ts             # Claude API + regex parsing
│   │       ├── router.ts             # Region → owner mapping
│   │       ├── writer.ts             # Supabase lead insert
│   │       ├── notify.ts             # Summary email sender
│   │       ├── dedup.ts              # Message ID dedup (local JSON)
│   │       └── types.ts              # Scanner-specific types
│   └── components/
│       └── leads/
│           ├── LeadsList.tsx          # Leads table component
│           ├── LeadDetail.tsx         # Lead detail/edit component
│           └── LeadStatusBadge.tsx    # Status pill component
├── scripts/
│   ├── run-scanner.ts                # PM2 entry point (tsx)
│   └── gmail-auth.ts                 # One-time OAuth setup script
├── supabase/
│   └── migrations/
│       └── 017_add_leads.sql         # Leads table + programs.lead_id FK
├── data/
│   └── processed-ids.json            # Dedup store (gitignored)
└── ecosystem.config.js               # PM2 configuration
```

### New Environment Variables

```env
# Gmail OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GMAIL_USER_EMAIL=

# Scanner
ANTHROPIC_API_KEY=          # already in .env for PDF extraction
NOTIFICATION_RECIPIENTS=email1@qceventdesign.com,email2@qceventdesign.com
ALERT_EMAIL=gary@stackindustries.com
SCAN_CRON=0 7,11,14,16 * * *
TZ=America/New_York
```

### Data Model Change

```sql
-- New leads table (full schema in Feature 1)
-- Add FK from programs to leads
alter table programs add column lead_id uuid references leads(id);
```

### Build Order

|Phase|What                              |Why this order                                  |
|-----|----------------------------------|------------------------------------------------|
|1a   |Leads table migration             |Everything depends on the table existing        |
|1b   |Leads list page + lead detail page|Team can manually add and view leads immediately|
|1c   |Lead-to-program linking           |Connects leads to the existing estimate workflow|
|1d   |Region router config              |Small, testable, needed by scanner              |
|2a   |Gmail scanner module              |Core automation                                 |
|2b   |Claude parser + regex fallback    |Core automation                                 |
|2c   |Supabase writer + dedup           |Core automation                                 |
|2d   |Notification email                |Polish                                          |
|2e   |Error handling + logging          |Polish                                          |
|2f   |PM2 config + Mac deployment       |Ship it                                         |

-----

## Risks & Mitigations

|Risk                            |Category |Severity|Likelihood|Mitigation                                                                |
|--------------------------------|---------|--------|----------|--------------------------------------------------------------------------|
|Google OAuth token expires      |Technical|High    |Low       |Publish GCP project to Production. Alert email on auth failure.           |
|Mac sleeps, misses scan         |Technical|Medium  |Medium    |PM2 + macOS Energy Saver. 4-hour scan overlap catches missed windows.     |
|Claude API parsing fails        |Technical|Medium  |Low       |Regex fallback. Log failures, don't skip leads.                           |
|GDP changes email format        |Data     |High    |Low       |Claude parsing is format-flexible. Monitor for failures.                  |
|Scanner deps bloat Vercel bundle|Technical|Low     |Low       |Scanner modules aren't imported by Next.js app. Tree-shaking handles it.  |
|Scope creep into CRM            |Personal |High    |High      |This PRD draws the line. No email threads, no follow-ups, no activity log.|
|Gary is the only fixer          |Personal |High    |High      |Clear README. PM2 logs. `pm2 restart` covers 90% of issues.               |

-----

## Open Questions

1. **Which Google account owns the OAuth credentials?** Gary's personal, Stack Industries, or a shared QCED account?
1. **Can Gary provide sample GDP INITIAL LEAD emails** (anonymized) as test fixtures for the parser?
1. **Is the ClickUp API token a personal token?** Needed to confirm it can be retired cleanly.
1. **What is the team Mac's model and macOS version?** For PM2 startup compatibility.
1. **Does the existing programs table have a client field that maps to lead client_name?** Need to verify the FK linkage.
