'use client';

import { useState, useCallback } from 'react';
import { upsertLocation, deleteLocation } from '@/app/(admin)/admin/actions';
import type { DbLocation } from '@/lib/supabase/queries';

interface Props {
  initialData: DbLocation[];
}

type Row = DbLocation & { isNew?: boolean };

function formatPct(val: number) {
  return (val * 100).toFixed(4).replace(/\.?0+$/, '') + '%';
}

function parsePct(val: string): number {
  return parseFloat(val.replace('%', '')) / 100;
}

function formatDate(val: string | null) {
  return val ?? '';
}

export default function LocationsTable({ initialData }: Props) {
  const [rows, setRows] = useState<Row[]>(initialData);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const startEdit = (rowId: string, col: string) => {
    setEditingCell({ rowId, col });
  };

  const saveRow = useCallback(async (row: Row) => {
    setSaveError(null);
    const result = await upsertLocation({
      id: row.isNew ? undefined : row.id,
      name: row.name,
      food_tax_rate: row.food_tax_rate,
      alcohol_tax_rate: row.alcohol_tax_rate,
      general_tax_rate: row.general_tax_rate,
      effective_date: row.effective_date,
    });
    if (result.error) {
      setSaveError(result.error);
    } else if (row.isNew) {
      // Reload the page data since we need the DB-generated id
      window.location.reload();
    }
  }, []);

  const updateCell = (rowId: string, col: keyof Row, rawValue: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (col === 'food_tax_rate' || col === 'alcohol_tax_rate' || col === 'general_tax_rate') {
          const num = parsePct(rawValue);
          return isNaN(num) ? r : { ...r, [col]: num };
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
    setRows((prev) => [
      ...prev,
      {
        id: tempId,
        name: 'New Location',
        food_tax_rate: 0,
        alcohol_tax_rate: 0,
        general_tax_rate: 0,
        effective_date: new Date().toISOString().split('T')[0],
        updated_at: '',
        isNew: true,
      },
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
    const result = await deleteLocation(id);
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
          <h2 className="text-base font-semibold text-brand-charcoal">Locations</h2>
          {lastUpdated && (
            <p className="text-xs text-brand-silver mt-0.5">
              Last updated {new Date(lastUpdated).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          onClick={addRow}
          className="text-sm text-brand-brown hover:text-brand-charcoal font-medium transition-colors"
        >
          + Add location
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
              <th className="text-left px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide w-56">Location</th>
              <th className="text-right px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide w-28">Food Tax</th>
              <th className="text-right px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide w-28">Alcohol Tax</th>
              <th className="text-right px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide w-28">General Tax</th>
              <th className="text-left px-4 py-2.5 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide w-32">Effective Date</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream/60">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-brand-offwhite transition-colors">
                {(['name', 'food_tax_rate', 'alcohol_tax_rate', 'general_tax_rate', 'effective_date'] as const).map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.col === col;
                  const isNumeric = col !== 'name' && col !== 'effective_date';
                  const displayValue = col === 'food_tax_rate' || col === 'alcohol_tax_rate' || col === 'general_tax_rate'
                    ? formatPct(row[col] as number)
                    : col === 'effective_date'
                    ? formatDate(row.effective_date)
                    : row[col] as string;

                  return (
                    <td
                      key={col}
                      className={`px-4 py-2 ${isNumeric ? 'text-right' : ''}`}
                      onClick={() => startEdit(row.id, col)}
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
                            if (e.key === 'Escape') { setEditingCell(null); }
                          }}
                          className={`w-full border border-brand-brown rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper ${isNumeric ? 'text-right' : ''}`}
                        />
                      ) : (
                        <span className={`cursor-text ${!displayValue ? 'text-brand-silver/40' : 'text-brand-charcoal'}`}>
                          {displayValue || 'Click to edit'}
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
