'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DbStaffingRole, DbTeamMember, StaffingStatus } from '@/lib/supabase/queries';
import {
  addStaffingRole,
  updateStaffingRole,
  deleteStaffingRole,
} from '@/app/(programs)/programs/actions';

interface Props {
  programId: string;
  initialRoles: DbStaffingRole[];
  teamMembers: DbTeamMember[];
}

const STATUS_LABELS: Record<string, string> = {
  needs_staffing: 'Needs Staffing',
  assigned: 'Assigned',
  confirmed: 'Confirmed',
};

const STATUS_COLORS: Record<string, string> = {
  needs_staffing: 'text-red-600',
  assigned: 'text-amber-600',
  confirmed: 'text-green-600',
};

export default function StaffingSection({ programId, initialRoles, teamMembers }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [roles, setRoles] = useState<DbStaffingRole[]>(initialRoles);
  const [newRole, setNewRole] = useState('');
  const [adding, setAdding] = useState(false);

  const confirmed = roles.filter((r) => r.status === 'confirmed').length;
  const needsStaffing = roles.filter((r) => r.status === 'needs_staffing').length;

  async function handleAdd() {
    const role = newRole.trim();
    if (!role) return;
    setAdding(true);
    const { id: newId, error } = await addStaffingRole(programId, role);
    if (!error && newId) {
      const now = new Date().toISOString();
      setRoles((prev) => [...prev, {
        id: newId, program_id: programId, role,
        assigned_to: null, status: 'needs_staffing' as StaffingStatus, notes: null,
        sort_order: prev.length, created_at: now, updated_at: now,
      }]);
      setNewRole('');
    }
    setAdding(false);
  }

  function handleUpdate(id: string, patch: { assigned_to?: number | null; status?: StaffingStatus; notes?: string | null }) {
    setRoles((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
    startTransition(async () => {
      await updateStaffingRole(id, programId, patch);
      router.refresh();
    });
  }

  async function handleDelete(id: string) {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    await deleteStaffingRole(id, programId);
    router.refresh();
  }

  const activeMembers = teamMembers.filter((m) => m.is_active);

  const fieldCls = 'text-xs border border-brand-cream rounded px-2 py-1 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-brand-charcoal">Onsite Staffing</h3>
          {roles.length > 0 && (
            <p className={`text-xs mt-0.5 ${needsStaffing > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {confirmed} of {roles.length} confirmed
              {needsStaffing > 0 && ` · ${needsStaffing} need${needsStaffing === 1 ? 's' : ''} staffing`}
            </p>
          )}
        </div>
      </div>

      {roles.length > 0 && (
        <div className="border border-brand-cream rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-offwhite border-b border-brand-cream">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-brand-charcoal/60">Role</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-brand-charcoal/60 w-40">Assigned To</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-brand-charcoal/60 w-36">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-brand-charcoal/60">Notes</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream/60">
              {roles.map((role) => (
                <tr key={role.id} className="bg-white">
                  <td className="px-3 py-2 font-medium text-brand-charcoal text-xs">{role.role}</td>
                  <td className="px-3 py-2">
                    <select
                      value={role.assigned_to != null ? String(role.assigned_to) : ''}
                      onChange={(e) => handleUpdate(role.id, { assigned_to: e.target.value ? Number(e.target.value) : null })}
                      className={fieldCls + ' w-full'}
                    >
                      <option value="">— Unassigned —</option>
                      {activeMembers.map((m) => (
                        <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={role.status}
                      onChange={(e) => handleUpdate(role.id, { status: e.target.value as StaffingStatus })}
                      className={fieldCls + ' w-full ' + (STATUS_COLORS[role.status] ?? '')}
                    >
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={role.notes ?? ''}
                      onChange={(e) => setRoles((prev) => prev.map((r) => r.id === role.id ? { ...r, notes: e.target.value } : r))}
                      onBlur={(e) => handleUpdate(role.id, { notes: e.target.value || null })}
                      placeholder="Optional notes"
                      className={fieldCls + ' w-full'}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="text-brand-silver/50 hover:text-red-500 transition-colors"
                      title="Remove role"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add role */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="Role name (e.g., Event Captain)"
          className="flex-1 border border-brand-cream rounded px-3 py-1.5 text-sm bg-white text-brand-charcoal placeholder:text-brand-silver focus:outline-none focus:ring-1 focus:ring-brand-copper"
        />
        <button
          onClick={handleAdd}
          disabled={!newRole.trim() || adding}
          className="text-sm font-medium px-3 py-1.5 rounded border border-brand-copper text-brand-copper hover:bg-brand-copper/10 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {adding ? 'Adding…' : '+ Add Role'}
        </button>
      </div>
    </div>
  );
}
