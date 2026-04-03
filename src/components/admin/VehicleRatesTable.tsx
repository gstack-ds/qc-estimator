'use client';

import { useState, useCallback } from 'react';
import { upsertVehicleRate, deleteVehicleRate } from '@/app/(admin)/admin/actions';
import type { DbVehicleRate } from '@/lib/supabase/queries';

type Row = DbVehicleRate & { isNew?: boolean };
type NumCol = 'sedan_hourly' | 'sedan_airport' | 'suv_hourly' | 'suv_airport' | 'sprinter_hourly' | 'sprinter_airport';

function parseCurrency(val: string): number { return parseFloat(val.replace(/[$,]/g, '')) || 0; }
function formatCurrency(val: number) { return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

const COLUMNS: { key: keyof Row; label: string; isNum: boolean }[] = [
  { key: 'market', label: 'Market', isNum: false },
  { key: 'sedan_hourly', label: 'Sedan/hr', isNum: true },
  { key: 'sedan_airport', label: 'Sedan Airport', isNum: true },
  { key: 'suv_hourly', label: 'SUV/hr', isNum: true },
  { key: 'suv_airport', label: 'SUV Airport', isNum: true },
  { key: 'sprinter_hourly', label: 'Sprinter/hr', isNum: true },
  { key: 'sprinter_airport', label: 'Sprinter Airport', isNum: true },
];

export default function VehicleRatesTable({ initialData }: { initialData: DbVehicleRate[] }) {
  const [rows, setRows] = useState<Row[]>(initialData);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const saveRow = useCallback(async (row: Row) => {
    setSaveError(null);
    const result = await upsertVehicleRate({
      id: row.isNew ? undefined : row.id,
      market: row.market,
      sedan_hourly: row.sedan_hourly,
      sedan_airport: row.sedan_airport,
      suv_hourly: row.suv_hourly,
      suv_airport: row.suv_airport,
      sprinter_hourly: row.sprinter_hourly,
      sprinter_airport: row.sprinter_airport,
    });
    if (result.error) setSaveError(result.error);
    else if (row.isNew) window.location.reload();
  }, []);

  const updateCell = (rowId: string, col: keyof Row, raw: string) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      if (col === 'market') return { ...r, market: raw };
      return { ...r, [col]: parseCurrency(raw) };
    }));
  };

  const handleBlur = async (rowId: string) => { setEditingCell(null); const row = rows.find((r) => r.id === rowId); if (row) await saveRow(row); };
  const addRow = () => {
    const id = `new-${Date.now()}`;
    setRows((p) => [...p, { id, market: 'New Market', sedan_hourly: 0, sedan_airport: 0, suv_hourly: 0, suv_airport: 0, sprinter_hourly: 0, sprinter_airport: 0, updated_at: '', isNew: true }]);
    setEditingCell({ rowId: id, col: 'market' });
  };
  const handleDelete = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row?.isNew) { setRows((p) => p.filter((r) => r.id !== id)); setConfirmDelete(null); return; }
    const result = await deleteVehicleRate(id);
    if (result.error) setSaveError(result.error); else setRows((p) => p.filter((r) => r.id !== id));
    setConfirmDelete(null);
  };

  const lastUpdated = rows.reduce((l, r) => (!r.updated_at ? l : !l || r.updated_at > l ? r.updated_at : l), '');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-charcoal">Vehicle Rates</h3>
          {lastUpdated && <p className="text-xs text-brand-silver mt-0.5">Last updated {new Date(lastUpdated).toLocaleDateString()}</p>}
        </div>
        <button onClick={addRow} className="text-sm text-brand-brown hover:text-brand-charcoal font-medium transition-colors">+ Add market</button>
      </div>
      {saveError && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">Save failed: {saveError}</div>}
      <div className="overflow-x-auto rounded-lg border border-brand-cream">
        <table className="text-sm" style={{ minWidth: '800px', width: '100%' }}>
          <thead className="bg-brand-offwhite border-b border-brand-cream">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium text-brand-charcoal/60 text-xs uppercase tracking-wide ${c.isNum ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream/60">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-brand-offwhite transition-colors">
                {COLUMNS.map(({ key, isNum }) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.col === key;
                  const val = row[key] as string | number;
                  const display = isNum ? formatCurrency(val as number) : (val as string);
                  return (
                    <td key={key} className={`px-3 py-2 ${isNum ? 'text-right' : ''}`} onClick={() => setEditingCell({ rowId: row.id, col: key })}>
                      {isEditing ? (
                        <input autoFocus defaultValue={display} onBlur={(e) => { updateCell(row.id, key, e.target.value); handleBlur(row.id); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null); }} className={`w-full border border-brand-brown rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper ${isNum ? 'text-right' : ''}`} />
                      ) : (
                        <span className={`cursor-text ${!display ? 'text-brand-silver/40' : 'text-brand-charcoal'}`}>{display || 'Click to edit'}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center">
                  {confirmDelete === row.id ? (<span className="flex items-center gap-1 text-xs"><button onClick={() => handleDelete(row.id)} className="text-red-600 font-medium hover:underline">Delete</button><button onClick={() => setConfirmDelete(null)} className="text-gray-400 hover:underline">Cancel</button></span>)
                    : (<button onClick={() => setConfirmDelete(row.id)} className="text-brand-silver/40 hover:text-red-500 transition-colors text-base leading-none" title="Delete">×</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
