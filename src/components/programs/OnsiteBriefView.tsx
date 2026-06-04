'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Sparkles, Edit3, Check, Copy, ChevronDown, ChevronRight, User } from 'lucide-react';
import type { ProgramBrief } from '@/lib/briefs/types';
import { BRIEF_SECTIONS, BRIEF_SECTION_LABELS, AI_SECTIONS, type BriefSectionKey } from '@/lib/briefs/types';
import type { DbTeamMember } from '@/lib/supabase/queries';
import { saveBriefSection, saveBriefSectionOwner } from '@/app/(programs)/programs/actions';

interface Props {
  programId: string;
  programName: string;
  brief: ProgramBrief;
  teamMembers: DbTeamMember[];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Editable section ────────────────────────────────────

function BriefSection({
  sectionKey, programId, brief, teamMembers,
}: {
  sectionKey: BriefSectionKey;
  programId: string;
  brief: ProgramBrief;
  teamMembers: DbTeamMember[];
}) {
  const section = brief.content[sectionKey];
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section?.content ?? '');
  const [ownerId, setOwnerId] = useState<string>(String(brief.section_owners?.[sectionKey] ?? ''));
  const [, startTransition] = useTransition();
  const isAi = section?.isAiDraft !== false && AI_SECTIONS.has(sectionKey);
  const owner = teamMembers.find(m => String(m.id) === ownerId);

  function handleSave() {
    setEditing(false);
    startTransition(async () => {
      await saveBriefSection(programId, sectionKey, draft);
    });
  }

  function handleOwnerChange(newOwnerId: string) {
    setOwnerId(newOwnerId);
    startTransition(async () => {
      await saveBriefSectionOwner(programId, sectionKey, newOwnerId ? Number(newOwnerId) : null);
    });
  }

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="border border-brand-cream rounded-xl overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-brand-offwhite hover:bg-brand-cream/30 transition-colors text-left"
      >
        {expanded ? <ChevronDown size={14} className="text-brand-silver flex-shrink-0" /> : <ChevronRight size={14} className="text-brand-silver flex-shrink-0" />}
        <span className="text-sm font-semibold text-brand-charcoal flex-1">{BRIEF_SECTION_LABELS[sectionKey]}</span>
        {/* Owner badge */}
        {owner && (
          <span className="flex items-center gap-1 text-[10px] text-brand-silver bg-brand-cream/60 rounded-full px-2 py-0.5 flex-shrink-0">
            <User size={9} />
            {owner.first_name}
          </span>
        )}
        {isAi && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 flex-shrink-0">
            <Sparkles size={9} />
            AI draft
          </span>
        )}
      </button>

      {/* Section body */}
      {expanded && (
        <div className="bg-white px-4 py-3 space-y-2">
          {editing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={Math.max(4, draft.split('\n').length + 1)}
                className="w-full text-sm font-mono border border-brand-copper/40 rounded-lg px-3 py-2 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 text-xs bg-brand-brown text-white rounded px-3 py-1.5 hover:bg-brand-charcoal transition-colors"
                >
                  <Check size={11} /> Save
                </button>
                <button
                  onClick={() => { setDraft(section?.content ?? ''); setEditing(false); }}
                  className="text-xs text-brand-silver hover:text-brand-charcoal transition-colors px-2 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="group relative"
              onClick={stopProp}
            >
              {sectionKey === 'financialDetails' && section?.content ? (
                <FinancialDetailsTable content={section.content} />
              ) : (
                <pre className="text-sm text-brand-charcoal whitespace-pre-wrap font-sans leading-relaxed min-h-[2rem]">
                  {section?.content || <span className="text-brand-silver italic">No content yet</span>}
                </pre>
              )}
              <button
                onClick={() => { setDraft(section?.content ?? ''); setEditing(true); }}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-brand-silver hover:text-brand-brown px-2 py-1 bg-white border border-brand-cream rounded"
              >
                <Edit3 size={10} /> Edit
              </button>
            </div>
          )}

          {section?.lastEditedAt && (
            <p className="text-[10px] text-brand-silver/60">Last edited {fmtDate(section.lastEditedAt)}</p>
          )}
          {section?.sourceHint && (
            <p className="text-[10px] text-brand-silver/60">Source: {section.sourceHint}</p>
          )}
          {/* Owner assignment */}
          <div className="flex items-center gap-2 pt-1" onClick={stopProp}>
            <User size={10} className="text-brand-silver/60" />
            <select
              value={ownerId}
              onChange={e => handleOwnerChange(e.target.value)}
              className="text-[10px] border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
            >
              <option value="">No owner</option>
              {teamMembers.map(m => (
                <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Financial Details table ──────────────────────────────

interface FinancialRow { label: string; value: string }
interface FinancialSection { header: string; rows: FinancialRow[] }

function parseFinancialContent(content: string): FinancialSection[] {
  const sections: FinancialSection[] = [];
  let current: FinancialSection | null = null;
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('===')) {
      current = { header: line.replace(/===/g, '').trim(), rows: [] };
      sections.push(current);
    } else if (current) {
      const colonIdx = line.lastIndexOf(': ');
      if (colonIdx > 0) current.rows.push({ label: line.slice(0, colonIdx), value: line.slice(colonIdx + 2) });
    }
  }
  return sections.filter(s => s.rows.length > 0);
}

function FinancialDetailsTable({ content }: { content: string }) {
  const sections = parseFinancialContent(content);
  if (!sections.length) {
    return <pre className="text-sm text-brand-charcoal whitespace-pre-wrap font-sans leading-relaxed min-h-[2rem]">{content}</pre>;
  }
  return (
    <div className="space-y-4">
      {sections.map((sec, si) => (
        <div key={si}>
          <p className="text-[10px] font-semibold text-brand-charcoal/50 uppercase tracking-wide mb-1.5">{sec.header}</p>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {sec.rows.map((row, ri) => {
                const isTotal = row.label === 'TOTAL' || row.label === 'Per Person';
                return (
                  <tr key={ri} className={`border-b border-brand-cream/60 ${isTotal ? 'font-semibold' : ''}`}>
                    <td className="py-1.5 pr-4 text-brand-charcoal/80">{row.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-brand-charcoal">{row.value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ─── Copy brief helper ────────────────────────────────────

function buildMarkdownFinancial(sections: FinancialSection[]): string {
  return sections.map(sec => {
    const rows = sec.rows.map(r => `| ${r.label} | ${r.value} |`).join('\n');
    return `**${sec.header}**\n\n| Item | Amount |\n|------|--------|\n${rows}`;
  }).join('\n\n');
}

function buildPlainTextBrief(brief: ProgramBrief, programName: string): string {
  const lines = [`ONSITE BRIEF — ${programName.toUpperCase()}`, ''];
  for (const key of BRIEF_SECTIONS) {
    const section = brief.content[key];
    if (!section?.content) continue;
    lines.push(`== ${BRIEF_SECTION_LABELS[key].toUpperCase()} ==`);
    if (section.isAiDraft) lines.push('[AI DRAFT — REVIEW BEFORE SHARING]');
    if (key === 'financialDetails') {
      const sections = parseFinancialContent(section.content);
      lines.push(sections.length ? buildMarkdownFinancial(sections) : section.content);
    } else {
      lines.push(section.content);
    }
    lines.push('');
  }
  lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`);
  return lines.join('\n');
}

// ─── Main component ───────────────────────────────────────

export default function OnsiteBriefView({ programId, programName, brief, teamMembers }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = buildPlainTextBrief(brief, programName);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-xl font-medium text-brand-charcoal">{programName}</h1>
          <p className="text-xs text-brand-silver mt-0.5">
            Onsite Brief · Generated {fmtDate(brief.generated_at)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs border border-brand-cream rounded px-3 py-1.5 text-brand-charcoal/70 hover:text-brand-charcoal hover:bg-brand-offwhite transition-colors"
          >
            <Copy size={11} />
            {copied ? 'Copied!' : 'Copy brief'}
          </button>
          <Link
            href={`/programs/${programId}`}
            className="flex items-center gap-1.5 text-xs border border-brand-cream rounded px-3 py-1.5 text-brand-charcoal/70 hover:text-brand-charcoal hover:bg-brand-offwhite transition-colors"
          >
            ← Program page
          </Link>
        </div>
      </div>

      {/* AI draft notice */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
        <Sparkles size={13} className="flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">AI-drafted sections</span> are marked with a badge. Review and edit before sharing with the team or the client. Structured data sections (Event Basics, Financials, Transportation) are pulled directly from the system and do not require review.
        </div>
      </div>

      {/* Phase 2 notice for AI sections */}
      <div className="bg-brand-offwhite border border-brand-cream rounded-lg px-4 py-3 text-xs text-brand-silver">
        <span className="font-medium text-brand-charcoal">AI synthesis</span> (menu, dietary, contract terms, open items) coming in Phase 2 — upload your contract and menu PDFs in the Documents section, then regenerate. Today's brief contains all structured data from the system.
      </div>

      {/* Sections */}
      {BRIEF_SECTIONS.map(key => (
        <BriefSection
          key={key}
          sectionKey={key}
          programId={programId}
          brief={brief}
          teamMembers={teamMembers}
        />
      ))}
    </div>
  );
}
