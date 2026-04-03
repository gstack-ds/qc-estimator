'use client';

import { useState, useCallback } from 'react';
import { upsertDriveRoute, deleteDriveRoute } from '@/app/(admin)/admin/actions';
import type { DbDriveRoute } from '@/lib/supabase/queries';

type Row = DbDriveRoute & { isNew?: boolean };

function parseCurrency(val: string): number {
  return parseFloat(val.replace(/[$,]/g, '')) || 0;
}

function formatCurrency(val: number) {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DriveRoutesTable({ initialData }: { initialData: DbDriveRoute[] }) {
  const [rows, setRows] = useState<Row[]>(initialData);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const saveRow = useCallback(async (row: Row) => {
    setSaveError(null);
    const result = await upsertDriveRoute({ id: row.isNew ? undefined : row.id, route_name: row.route_name, cost: row.cost });
    if (result.error) setSaveError(result.error);
    else if (row.isNew) window.location.reload();
  }, []);

  const updateCell = (rowId: string, col: keyof Row, raw: string) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      if (col === 'cost') return { ...r, cost: parseCurrency(raw) };
      return { ...r, [col]: raw };
    }));
  };

  const handleBlur = async (rowId: string) => {
    setEditingCell(null);
    const row = rows.find((r) => r.id === rowId);
    if (row) await saveRow(row);
  };

  const addRow = () => {
    const tempId = `new-${Date.now()}`;
    setRows((prev) => [...prev, { id: tempId, route_name: 'New Route', cost: 0, updated_at: '', isNew: true }]);
    setEditingCell({ rowId: tempId, col: 'route_name' });
  };

  const handleDelete = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row?.isNew) { setRows((prev) => prev.filter((r) => r.id !== id)); setConfirmDelete(null); return; }
    const result = await deleteDriveRoute(id);
    if (result.error) setSaveError(result.error);
    else setRows((prev) => prev.filter((r) => r.id !== id));
    setConfirmDelete(null);
  };

  const lastUpdated = rows.reduce((l, r) => (!r.updated_at ? l : !l || r.updated_at > l ? r.updated_at : l), '');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-charcoal">Drive Routes</h3>
          {lastUpdated && <p className="text-xs text-brand-silver mt-0.5">Last updated {new Date(lastUpdated).toLocaleDateString()}</p>}
        </div>
        <button onClick={addRow} className="text-sm text-brand-brown hover:text-brand-charcoal font-medium transition-colors">+ Add route</button>
      </div>
      {saveError && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">Save failed: {saveError}</div>}
      <div className="overflow-x-auto rounded-lg border border-brand-cream">
        <table className="w-full text-sm">
          <thead className="bg-brand-offwhite border-b border-brand-cream">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide">Route</th>
              <th className="text-right px-4 py-2 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide w-32">Flat Cost</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream/60">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-brand-offwhite transition-colors">
                {(['route_name', 'cost'] as const).map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.col === col;
                  const isNum = col === 'cost';
                  const display = col === 'cost' ? formatCurrency(row.cost) : row.route_name;
                  return (
                    <td key={col} className={`px-4 py-2 ${isNum ? 'text-right' : ''}`} onClick={() => setEditingCell({ rowId: row.id, col })}>
                      {isEditing ? (
                        <input autoFocus defaultValue={display}
                          onBlur={(e) => { updateCell(row.id, col, e.target.value); handleBlur(row.id); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null); }}
                          className={`w-full border border-brand-brown rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper ${isNum ? 'text-right' : ''}`} />
                      ) : (
                        <span className={`cursor-text ${!display ? 'text-brand-silver/40' : 'text-brand-charcoal'}`}>{display || 'Click to edit'}</span>
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
                    <button onClick={() => setConfirmDelete(row.id)} className="text-brand-silver/40 hover:text-red-500 transition-colors text-base leading-none" title="Delete">×</button>
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
