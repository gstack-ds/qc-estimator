'use client';

import { useState, useEffect, useRef } from 'react';
import { getTemplates, deleteTemplate, type DbTemplate } from '@/app/(programs)/programs/[id]/estimates/actions';

interface Props {
  onSelect: (template: DbTemplate) => void;
  onClose: () => void;
}

export default function TemplatePickerDropdown({ onSelect, onClose }: Props) {
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTemplates().then(({ templates, currentUserId }) => {
      setTemplates(templates);
      setCurrentUserId(currentUserId);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    (t.category_name ?? '').toLowerCase().includes(query.toLowerCase())
  );

  async function handleDelete(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete the template "${name}"? This removes it from the shared team pool for everyone.`)) return;
    setDeleteError(null);
    setDeletingId(id);
    const { error } = await deleteTemplate(id);
    if (error) {
      // RLS only lets a user delete their own templates; surface anything unexpected
      // instead of optimistically removing a row that's still in the DB.
      setDeleteError(error);
      setDeletingId(null);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 left-0 top-full mt-1 w-72 bg-white border border-brand-cream rounded-lg shadow-lg overflow-hidden"
    >
      <div className="p-2 border-b border-brand-cream">
        <input
          autoFocus
          type="text"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper"
        />
      </div>

      <div className="max-h-56 overflow-y-auto">
        {loading && (
          <p className="text-xs text-brand-silver px-3 py-4 text-center">Loading…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-brand-silver px-3 py-4 text-center italic">
            {templates.length === 0 ? 'No templates saved yet' : 'No matches'}
          </p>
        )}
        {filtered.map((t) => {
          const isOwner = currentUserId != null && t.created_by === currentUserId;
          return (
            <div
              key={t.id}
              onClick={() => { onSelect(t); onClose(); }}
              className="flex items-center justify-between px-3 py-2 hover:bg-brand-offwhite cursor-pointer group border-b border-brand-cream/50 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm text-brand-charcoal truncate">{t.name}</div>
                <div className="text-xs text-brand-silver">
                  {t.category_name ?? 'No category'}{t.default_unit_price > 0 ? ` · $${t.default_unit_price.toFixed(2)}` : ''}
                </div>
              </div>
              {isOwner ? (
                <button
                  onClick={(e) => handleDelete(t.id, t.name, e)}
                  disabled={deletingId === t.id}
                  className="ml-2 opacity-0 group-hover:opacity-100 text-brand-silver/60 hover:text-red-500 text-base leading-none transition-all flex-shrink-0 disabled:opacity-40"
                  title="Delete your template"
                  aria-label={`Delete template ${t.name}`}
                >
                  ×
                </button>
              ) : (
                <span
                  className="ml-2 opacity-0 group-hover:opacity-100 text-[10px] text-brand-silver/40 italic transition-all flex-shrink-0"
                  title="Only the person who created a template can delete it"
                >
                  shared
                </span>
              )}
            </div>
          );
        })}
      </div>

      {deleteError && (
        <div className="px-3 py-2 border-t border-brand-cream bg-red-50 text-[11px] text-red-600">
          Couldn’t delete: {deleteError}
        </div>
      )}
    </div>
  );
}
