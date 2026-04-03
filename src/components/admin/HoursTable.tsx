'use client';

import { useState, useCallback } from 'react';
import { upsertTier, deleteTier } from '@/app/(admin)/admin/actions';
import type { DbTier } from '@/lib/supabase/queries';

interface Props {
  initialData: DbTier[];
}

type Row = DbTier & { isNew?: boolean };

function formatCurrency(val: number) {
  return '$' + val.toLocaleString('en-US');
}

export default function HoursTable({ initialData }: Props) {
  const [rows, setRows] = useState<Row[]>(initialData);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const saveRow = useCallback(async (row: Row) => {
    setSaveError(null);
    const result = await upsertTier({
      id: row.isNew ? undefined : row.id,
      revenue_threshold: row.revenue_threshold,
      base_hours: row.base_hours,
      tier_name: row.tier_name,
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
        if (col === 'revenue_threshold' || col === 'base_hours') {
          const num = parseFloat(rawValue.replace(/[$,]/g, ''));
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
      { id: tempId, revenue_threshold: 0, base_hours: 0, tier_name: '', created_at: '', isNew: true },
    ]);
    setEditingCell({ rowId: tempId, col: 'revenue_threshold' });
  };

  const handleDelete = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row?.isNew) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmDelete(null);
      return;
    }
    const result = await deleteTier(id);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Team Hours Tiers</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Revenue thresholds for estimating team hours (OpEx = hours × $90)
          </p>
        </div>
        <button onClick={addRow} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add tier
        </button>
      </div>

      {saveError && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          Save failed: {saveError}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-36">Tier Name</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-40">Revenue Threshold</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-28">Base Hours</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-28">OpEx Est.</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {(['tier_name', 'revenue_threshold', 'base_hours'] as const).map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.col === col;
                  const isRight = col !== 'tier_name';
                  let displayValue: string;
                  if (col === 'revenue_threshold') displayValue = formatCurrency(row.revenue_threshold);
                  else if (col === 'base_hours') displayValue = String(row.base_hours);
                  else displayValue = row.tier_name ?? '';

                  return (
                    <td
                      key={col}
                      className={`px-4 py-2 ${isRight ? 'text-right' : ''}`}
                      onClick={() => setEditingCell({ rowId: row.id, col })}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={col === 'revenue_threshold' ? String(row.revenue_threshold) : displayValue}
                          onBlur={(e) => {
                            updateCell(row.id, col, e.target.value);
                            handleBlur(row.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className={`w-full border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${isRight ? 'text-right' : ''}`}
                        />
                      ) : (
                        <span className={`cursor-text ${!displayValue ? 'text-gray-300' : 'text-gray-900'}`}>
                          {displayValue || 'Click to edit'}
                        </span>
                      )}
                    </td>
                  );
                })}
                {/* Computed OpEx column */}
                <td className="px-4 py-2 text-right text-gray-500">
                  {formatCurrency(row.base_hours * 90)}
                </td>
                <td className="px-2 py-2 text-center">
                  {confirmDelete === row.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button onClick={() => handleDelete(row.id)} className="text-red-600 font-medium hover:underline">Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-gray-400 hover:underline">Cancel</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(row.id)}
                      className="text-gray-300 hover:text-red-500 text-base leading-none"
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
