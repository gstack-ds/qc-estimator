import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBudgetShareContract, type BudgetShareContract } from '@/lib/budget/budgetShareContract';
import { isPublicSharePath, isPublicShareApi, isPublicBudgetSurface } from '@/lib/budget/sharePath';
import BudgetDocumentView from '@/components/budget/BudgetDocumentView';
import type { BudgetLine, BudgetMember } from '@/lib/budget/budgetDocument';

// A real internal identifier that must NEVER reach the client snapshot or rendered HTML.
const INTERNAL_ESTIMATE_ID = 'a1b2c3d4-0000-4444-8888-deadbeefcafe';
const INTERNAL_NOTE = 'INTERNAL: upcharge 40% — do not show client';

function member(p: Partial<BudgetMember> = {}): BudgetMember {
  return {
    id: p.id ?? 'm1',
    sourceEstimateId: p.sourceEstimateId ?? INTERNAL_ESTIMATE_ID,
    tier: p.tier ?? null,
    label: p.label ?? null,
    derivedValue: p.derivedValue ?? 0,
    derivedPp: p.derivedPp ?? 0,
    overrideValue: p.overrideValue ?? null,
    sourceRemoved: p.sourceRemoved ?? false,
    rank: p.rank ?? 0,
    sortOrder: p.sortOrder ?? 0,
  };
}

function line(p: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: p.id ?? 'l1', eventId: p.eventId ?? 'ev1', name: p.name ?? 'Awards Dinner Design',
    aggregation: p.aggregation ?? 'sum', tiered: p.tiered ?? false, isPerPerson: p.isPerPerson ?? false,
    guestCount: p.guestCount ?? null, isOptional: p.isOptional ?? false, isIncluded: p.isIncluded ?? true,
    selectedMemberId: p.selectedMemberId ?? null, notes: p.notes ?? null, sortOrder: p.sortOrder ?? 0,
    members: p.members ?? [member({ derivedValue: 5000 })],
  };
}

function sampleContract(): BudgetShareContract {
  return buildBudgetShareContract({
    programName: 'Retail Elite 2027',
    guestCount: 250,
    events: [{ id: 'ev1', name: 'Awards Dinner' }],
    lines: [
      line({ id: 'l1', notes: INTERNAL_NOTE, members: [member({ id: 'm1', derivedValue: 5000, label: 'Design 1' })] }),
      line({
        id: 'l2', name: 'Band', aggregation: 'select_one', tiered: true, selectedMemberId: 'mid',
        members: [
          member({ id: 'lo', tier: 'low', derivedValue: 11250, label: '5-piece' }),
          member({ id: 'mid', tier: 'mid', derivedValue: 13300, label: '8-piece' }),
          member({ id: 'hi', tier: 'high', derivedValue: 18750, label: '10-piece' }),
        ],
      }),
    ],
    disclaimers: 'All pricing is estimated.',
  });
}

// Every key the contract is ALLOWED to contain. Any new key (e.g. a leaked cost/margin field)
// makes this fail — the structural guarantee.
const ALLOWED_KEYS = new Set([
  'version', 'programName', 'guestCount', 'events', 'lines', 'disclaimers',
  'id', 'name',
  'eventId', 'aggregation', 'tiered', 'isPerPerson', 'isOptional', 'isIncluded',
  'selectedMemberId', 'notes', 'sortOrder', 'members',
  'sourceEstimateId', 'tier', 'label', 'derivedValue', 'derivedPp', 'overrideValue', 'sourceRemoved', 'rank',
]);

const FORBIDDEN_SUBSTRINGS = ['cost', 'markup', 'margin', 'commission', 'vendor', 'profit', 'internal', 'assigned', 'taxrate'];

function collectKeys(value: unknown, into: Set<string>) {
  if (Array.isArray(value)) { value.forEach((v) => collectKeys(v, into)); return; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { into.add(k); collectKeys(v, into); }
  }
}

describe('isPublicSharePath — middleware allow-list (both directions)', () => {
  it('lets share links through', () => {
    expect(isPublicSharePath('/b/abc123')).toBe(true);
    expect(isPublicSharePath('/b/some-long-token')).toBe(true);
  });
  it('does NOT open authed routes', () => {
    for (const p of ['/', '/programs', '/programs/123', '/programs/123/budget', '/admin', '/leads', '/venues', '/b', '/budget', '/bb/x']) {
      expect(isPublicSharePath(p)).toBe(false);
    }
  });

  it('lets ONLY the public capture endpoint through, nothing else under /api/budget', () => {
    // The exact respond endpoint must bypass the auth gate (logged-out client posts here).
    expect(isPublicShareApi('/api/budget/abc123/respond')).toBe(true);
    expect(isPublicShareApi('/api/budget/some-long_token/respond')).toBe(true);
    expect(isPublicBudgetSurface('/api/budget/abc123/respond')).toBe(true);
    expect(isPublicBudgetSurface('/b/abc123')).toBe(true);
    // Anything else under /api/budget (or any other route) stays GATED — the bypass is exact.
    for (const p of [
      '/api/budget', '/api/budget/abc123', '/api/budget/abc123/delete', '/api/budget/admin/clear',
      '/api/budget/respond', '/api/scanner/run', '/api/render-deck', '/programs', '/admin',
    ]) {
      expect(isPublicShareApi(p)).toBe(false);
      expect(isPublicBudgetSurface(p)).toBe(false);
    }
  });
});

describe('BudgetShareContract — leak-proof (snapshot JSON)', () => {
  it('contains only whitelisted client-safe keys', () => {
    const keys = new Set<string>();
    collectKeys(sampleContract(), keys);
    const offenders = [...keys].filter((k) => !ALLOWED_KEYS.has(k));
    expect(offenders).toEqual([]);
  });

  it('has no internal field-name substrings (cost/markup/margin/commission/…)', () => {
    const keys = new Set<string>();
    collectKeys(sampleContract(), keys);
    for (const k of keys) {
      for (const bad of FORBIDDEN_SUBSTRINGS) {
        expect(k.toLowerCase().includes(bad)).toBe(false);
      }
    }
  });

  it('strips the source estimate id — no internal identifier in the snapshot JSON', () => {
    const json = JSON.stringify(sampleContract());
    expect(json).not.toContain(INTERNAL_ESTIMATE_ID);
    // and the field is present-but-null, never carrying a value
    for (const l of sampleContract().lines) for (const m of l.members) expect(m.sourceEstimateId).toBeNull();
  });

  it('strips internal line notes from the snapshot', () => {
    const json = JSON.stringify(sampleContract());
    expect(json).not.toContain(INTERNAL_NOTE);
    for (const l of sampleContract().lines) expect(l.notes).toBeNull();
  });
});

describe('BudgetDocumentView — leak-proof (rendered public HTML)', () => {
  const html = renderToStaticMarkup(createElement(BudgetDocumentView, { contract: sampleContract() }));

  it('renders client-facing values', () => {
    // selected total = 5000 (add-up) + 13300 (mid tier) = 18300
    expect(html).toContain('$18,300');
    expect(html).toContain('Retail Elite 2027');
    expect(html).toContain('8-piece'); // selected tier label
  });

  it('leaks no internal identifier or internal field name', () => {
    expect(html).not.toContain(INTERNAL_ESTIMATE_ID);
    const lower = html.toLowerCase();
    for (const bad of ['ourcost', 'markup', 'margin', 'commission', 'vendor cost', 'qcmargin']) {
      expect(lower).not.toContain(bad);
    }
  });
});
