-- 022_backfill_migration_020_columns.sql
-- One-time backfill: populates gdp_advisor, gdp_coordinator, third_party, and
-- lead_source_type from the original scanner-import columns (source_advisor,
-- source_coordinator, third_party_company, lead_source) for all leads where the
-- new column is still NULL.
--
-- Normalization logic mirrors writer.ts: exact match → first-token match → substring match.
-- Only rows where the new column IS NULL are updated to avoid overwriting manually set values.
-- Run once after migration 020 has been applied to production.


-- gdp_advisor: match against ['Shelley','Riley','Chris','Benoit','Dawn','Maxine']
UPDATE leads
SET gdp_advisor = CASE
  WHEN LOWER(TRIM(source_advisor)) = 'shelley'
    OR SPLIT_PART(LOWER(TRIM(source_advisor)), ' ', 1) = 'shelley'
    OR LOWER(source_advisor) LIKE '%shelley%'  THEN 'Shelley'
  WHEN LOWER(TRIM(source_advisor)) = 'riley'
    OR SPLIT_PART(LOWER(TRIM(source_advisor)), ' ', 1) = 'riley'
    OR LOWER(source_advisor) LIKE '%riley%'    THEN 'Riley'
  WHEN LOWER(TRIM(source_advisor)) = 'chris'
    OR SPLIT_PART(LOWER(TRIM(source_advisor)), ' ', 1) = 'chris'
    OR LOWER(source_advisor) LIKE '%chris%'    THEN 'Chris'
  WHEN LOWER(TRIM(source_advisor)) = 'benoit'
    OR SPLIT_PART(LOWER(TRIM(source_advisor)), ' ', 1) = 'benoit'
    OR LOWER(source_advisor) LIKE '%benoit%'   THEN 'Benoit'
  WHEN LOWER(TRIM(source_advisor)) = 'dawn'
    OR SPLIT_PART(LOWER(TRIM(source_advisor)), ' ', 1) = 'dawn'
    OR LOWER(source_advisor) LIKE '%dawn%'     THEN 'Dawn'
  WHEN LOWER(TRIM(source_advisor)) = 'maxine'
    OR SPLIT_PART(LOWER(TRIM(source_advisor)), ' ', 1) = 'maxine'
    OR LOWER(source_advisor) LIKE '%maxine%'   THEN 'Maxine'
  ELSE NULL
END
WHERE gdp_advisor IS NULL
  AND source_advisor IS NOT NULL
  AND TRIM(source_advisor) <> '';


-- gdp_coordinator: match against ['Amy','Maria','Jessica','Michelle','Maxime']
UPDATE leads
SET gdp_coordinator = CASE
  WHEN LOWER(TRIM(source_coordinator)) = 'amy'
    OR SPLIT_PART(LOWER(TRIM(source_coordinator)), ' ', 1) = 'amy'
    OR LOWER(source_coordinator) LIKE '%amy%'        THEN 'Amy'
  WHEN LOWER(TRIM(source_coordinator)) = 'maria'
    OR SPLIT_PART(LOWER(TRIM(source_coordinator)), ' ', 1) = 'maria'
    OR LOWER(source_coordinator) LIKE '%maria%'      THEN 'Maria'
  WHEN LOWER(TRIM(source_coordinator)) = 'jessica'
    OR SPLIT_PART(LOWER(TRIM(source_coordinator)), ' ', 1) = 'jessica'
    OR LOWER(source_coordinator) LIKE '%jessica%'    THEN 'Jessica'
  WHEN LOWER(TRIM(source_coordinator)) = 'michelle'
    OR SPLIT_PART(LOWER(TRIM(source_coordinator)), ' ', 1) = 'michelle'
    OR LOWER(source_coordinator) LIKE '%michelle%'   THEN 'Michelle'
  WHEN LOWER(TRIM(source_coordinator)) = 'maxime'
    OR SPLIT_PART(LOWER(TRIM(source_coordinator)), ' ', 1) = 'maxime'
    OR LOWER(source_coordinator) LIKE '%maxime%'     THEN 'Maxime'
  ELSE NULL
END
WHERE gdp_coordinator IS NULL
  AND source_coordinator IS NOT NULL
  AND TRIM(source_coordinator) <> '';


-- third_party: match against 24 THIRD_PARTY_OPTIONS from writer.ts
UPDATE leads
SET third_party = CASE
  WHEN LOWER(third_party_company) LIKE '%american express%'
    OR LOWER(third_party_company) = 'amex'                         THEN 'American Express'
  WHEN LOWER(third_party_company) = 'mms'
    OR LOWER(third_party_company) LIKE '%mms%'                     THEN 'MMS'
  WHEN LOWER(third_party_company) = 'ashfield'
    OR LOWER(third_party_company) LIKE '%ashfield%'                THEN 'Ashfield'
  WHEN LOWER(third_party_company) LIKE '%bishop mccann%'
    OR LOWER(third_party_company) LIKE '%bishop%mccann%'           THEN 'Bishop McCann'
  WHEN LOWER(third_party_company) LIKE '%bond brand%'              THEN 'Bond Brand Loyalty'
  WHEN LOWER(third_party_company) LIKE '%carrousel%'               THEN 'Carrousel Travel'
  WHEN LOWER(third_party_company) LIKE '%c2 events%'
    OR LOWER(third_party_company) = 'c2'                           THEN 'C2 Events Ltd'
  WHEN LOWER(third_party_company) LIKE '%conferencedirect%'
    OR LOWER(third_party_company) LIKE '%conference direct%'       THEN 'ConferenceDirect'
  WHEN LOWER(third_party_company) = 'cwt'
    OR LOWER(third_party_company) LIKE '%carlson wagonlit%'        THEN 'CWT'
  WHEN LOWER(third_party_company) = 'emota'
    OR LOWER(third_party_company) LIKE '%emota%'                   THEN 'Emota'
  WHEN LOWER(third_party_company) = 'eeg'
    OR LOWER(third_party_company) LIKE '%eeg%'                     THEN 'EEG'
  WHEN LOWER(third_party_company) LIKE '%sutton%'                  THEN 'Sutton Planning'
  WHEN LOWER(third_party_company) LIKE '%turner%'                  THEN 'The Turner Agency'
  WHEN LOWER(third_party_company) = 'yes'
    OR LOWER(third_party_company) LIKE '%yes events%'              THEN 'YES'
  WHEN LOWER(third_party_company) = 'mgme'
    OR LOWER(third_party_company) LIKE '%mgme%'                    THEN 'MGME'
  WHEN LOWER(third_party_company) = 'rubra'
    OR LOWER(third_party_company) LIKE '%rubra%'                   THEN 'Rubra'
  WHEN LOWER(third_party_company) LIKE '%meet events%'
    OR LOWER(third_party_company) = 'meet'                         THEN 'Meet Events'
  WHEN LOWER(third_party_company) LIKE '%first agency%'
    OR LOWER(third_party_company) = 'first'                        THEN 'FIRST Agency'
  WHEN LOWER(third_party_company) = 'marbet'
    OR LOWER(third_party_company) LIKE '%marbet%'                  THEN 'Marbet'
  WHEN LOWER(third_party_company) = 'dmi'
    OR LOWER(third_party_company) LIKE '%dmi%'                     THEN 'DMI'
  WHEN LOWER(third_party_company) LIKE '%world travel%'            THEN 'World Travel Inc'
  WHEN LOWER(third_party_company) LIKE '%strategic site%'          THEN 'Strategic Site Selection'
  WHEN LOWER(third_party_company) LIKE '%pure event%'              THEN 'Pure Event Management'
  WHEN LOWER(third_party_company) LIKE '%event strategy%'          THEN 'Event Strategy Group'
  ELSE NULL
END
WHERE third_party IS NULL
  AND third_party_company IS NOT NULL
  AND TRIM(third_party_company) <> '';


-- lead_source_type: normalizeLeadSource() logic from writer.ts
-- Priority: explicit keywords first, then fallback matchOption against dropdown values
UPDATE leads
SET lead_source_type = CASE
  WHEN LOWER(lead_source) LIKE '%gdp%'
    OR LOWER(lead_source) LIKE '%global%'                               THEN 'GDP'
  WHEN LOWER(lead_source) LIKE '%direct%'                               THEN 'Direct'
  WHEN LOWER(lead_source) LIKE '%rubra%'                                THEN 'Rubra'
  WHEN LOWER(lead_source) LIKE '%conference%'                           THEN 'Conference'
  WHEN LOWER(lead_source) LIKE '%sales coordinator%'
    OR LOWER(lead_source) LIKE '%sales coord%'                          THEN 'Sales Coordinator'
  ELSE NULL
END
WHERE lead_source_type IS NULL
  AND lead_source IS NOT NULL
  AND TRIM(lead_source) <> '';
