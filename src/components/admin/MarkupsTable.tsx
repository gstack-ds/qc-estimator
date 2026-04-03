'use client';

import { useState, useCallback } from 'react';
import { upsertMarkup, deleteMarkup } from '@/app/(admin)/admin/actions';
import type { DbMarkup } from '@/lib/supabase/queries';

interface Props {
  initialData: DbMarkup[];
}

type Row = DbMarkup & { isNew?: boolean };

function formatPct(val: number) {
  return (val * 100).toFixed(1).replace(/\.0$/, '') + '%';
}

function parsePct(val: string): number {
  return parseFloat(val.replace('%', '')) / 100;
}

export default function MarkupsTable({ initialData }: Props) {
  const [rows, setRows] = useState<Row[]>(initialData);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const saveRow = useCallback(async (row: Row) => {
    setSaveError(null);
    const result = await upsertMarkup({
      id: row.isNew ? undefined : row.id,
      name: row.name,
      markup_pct: row.markup_pct,
      notes: row.notes,
      sort_order: row.sort_order,
    });
    if (result.error) {
      setSaveError(result.error);
    } else if (row.isNew) {
      window.location.reload();
    }
  }, []);

  const updateCell = (rowId: string, col: keyof Row, rawValue: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (col === 'markup_pct') {
          const num = parsePct(rawValue);
          return isNaN(num) ? r : { ...r, markup_pct: num };
        }
        if (col === 'sort_order') {
          const num = parseInt(rawValue, 10);
          return isNaN(num) ? r : { ...r, sort_order: num };
        }
        return { ...r, [col]: rawValue };
      })
    );
  };

  const handleBlur = async (rowId: string) => {
    setEditingCell(null);
    const row = rows.find((r) => r.id === rowId);
    if (row) await saveRow(row);
  };

  const addRow = () => {
    const tempId = `new-${Date.now()}`;
    const maxOrder = Math.max(0, ...rows.map((r) => r.sort_order));
    setRows((prev) => [
      ...prev,
      { id: tempId, name: 'New Category', markup_pct: 0.5, notes: null, sort_order: maxOrder + 1, updated_at: '', isNew: true },
    ]);
    setEditingCell({ rowId: tempId, col: 'name' });
  };

  const handleDelete = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row?.isNew) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmDelete(null);
      return;
    }
    const result = await deleteMarkup(id);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
    setConfirmDelete(null);
  };

  const lastUpdated = rows.reduce((latest, r) => {
    if (!r.updated_at) return latest;
    return !latest || r.updated_at > latest ? r.updated_at : latest;
  }, '' as string);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-brand-charcoal">Category Markups</h2>
          {lastUpdated && (
            <p className="text-xs text-brand-silver mt-0.5">
              Last updated {new Date(lastUpdated).toLocaleDateString()}
            </p>
          )}
        </div>
        <button onClick={addRow} className="text-sm text-brand-brown hover:text-brand-charcoal font-medium transition-colors">
          + Add category
        </button>
      </div>

      {saveError && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          Save failed: {saveError}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-brand-cream">
        <table className="w-full text-sm">
          <thead className="bg-brand-offwhite border-b border-brand-cream">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide">Category</th>
              <th className="text-right px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide w-28">Markup</th>
              <th className="text-left px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide">Notes</th>
              <th className="text-right px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide w-20">Order</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream/60">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-brand-offwhite transition-colors">
                {(['name', 'markup_pct', 'notes', 'sort_order'] as const).map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.col === col;
                  const isRight = col === 'markup_pct' || col === 'sort_order';
                  let displayValue: string;
                  if (col === 'markup_pct') displayValue = formatPct(row.markup_pct);
                  else if (col === 'sort_order') displayValue = String(row.sort_order);
                  else if (col === 'notes') displayValue = row.notes ?? '';
                  else displayValue = row.name;

                  return (
                    <td
                      key={col}
                      className={`px-4 py-2 ${isRight ? 'text-right' : ''}`}
                      onClick={() => setEditingCell({ rowId: row.id, col })}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={displayValue}
                          onBlur={(e) => {
                            updateCell(row.id, col, e.target.value);
                            handleBlur(row.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className={`w-full border border-brand-brown rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper ${isRight ? 'text-right' : ''}`}
                        />
                      ) : (
                        <span className={`cursor-text ${!displayValue ? 'text-brand-silver/40' : col === 'markup_pct' ? 'font-medium text-brand-charcoal' : 'text-brand-charcoal'}`}>
                          {displayValue || (col === 'notes' ? '' : 'Click to edit')}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center">
                  {confirmDelete === row.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button onClick={() => handleDelete(row.id)} className="text-red-600 font-medium hover:underline">Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-gray-400 hover:underline">Cancel</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(row.id)}
                      className="text-brand-silver/40 hover:text-red-500 transition-colors text-base leading-none"
                      title="Delete row"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
