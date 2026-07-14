'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  Check,
  ChevronDown,
  Crown,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import StaffActivityFeed from '@/components/admin/staff-activity-feed';
import { adminFetch } from '@/lib/admin-api';
import { isAdminEmail } from '@/lib/admin-auth';
import { auth } from '@/lib/firebase';
import { getStaffByEmailClient, getStaffMembers } from '@/lib/firestore';
import type { Staff, StaffRole } from '@/lib/erp-types';
import {
  ASSIGNABLE_STAFF_ROLES,
  STANDARD_STAFF_ROLES,
  STAFF_ROLE_LABELS,
} from '@/lib/roles';

type StaffFilter = 'all' | 'pending' | 'active' | 'admins';

const ROLE_HINTS: Record<StaffRole, string> = {
  admin: 'Full console access',
  manager: 'Ops & team oversight',
  sales: 'POS & customers',
  inventory: 'Stock & warehouse',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function avatarTone(member: Staff) {
  if (member.isSuperAdmin) return 'from-violet-600 to-fuchsia-500';
  if (member.role === 'admin') return 'from-premium-blue to-cyan';
  if (member.role === 'manager') return 'from-emerald-600 to-teal-500';
  if (member.role === 'inventory') return 'from-amber-500 to-orange-500';
  return 'from-slate-600 to-slate-500';
}

function RoleBadge({ member }: { member: Staff }) {
  if (member.isSuperAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-500/20 sm:px-2.5 sm:py-1 sm:text-[11px]">
        <Crown size={11} />
        Super Admin
      </span>
    );
  }
  if (member.role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-premium-blue/10 px-2 py-0.5 text-[10px] font-semibold text-premium-blue ring-1 ring-premium-blue/20 sm:px-2.5 sm:py-1 sm:text-[11px]">
        <Shield size={11} />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100/90 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80 sm:px-2.5 sm:py-1 sm:text-[11px]">
      {STAFF_ROLE_LABELS[member.role]}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'default',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'violet' | 'blue';
}) {
  const styles = {
    default:
      'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    primary:
      'border-emerald-600/20 bg-emerald-600 text-white hover:bg-emerald-700',
    danger:
      'border-red-200 bg-white text-red-600 hover:bg-red-50',
    violet:
      'border-violet-200 bg-violet-50/90 text-violet-700 hover:bg-violet-50',
    blue: 'border-premium-blue/25 bg-premium-blue/5 text-premium-blue hover:bg-premium-blue/10',
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold touch-manipulation transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:w-auto sm:py-2 ${styles}`}
    >
      {children}
    </button>
  );
}

function StaffManagement() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [actorIsSuperAdmin, setActorIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<Record<string, StaffRole>>({});
  const [filter, setFilter] = useState<StaffFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const assignableRoles = actorIsSuperAdmin
    ? ASSIGNABLE_STAFF_ROLES
    : STANDARD_STAFF_ROLES;

  const resolveActorIsSuperAdmin = useCallback(async (email: string | null | undefined) => {
    if (!email) return false;
    if (isAdminEmail(email)) return true;
    try {
      const me = await getStaffByEmailClient(email);
      return Boolean(me?.active && me.isSuperAdmin);
    } catch {
      return false;
    }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const email = auth.currentUser?.email;

      try {
        const res = await adminFetch('/api/staff');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.error === 'string' ? data.error : 'Failed to load staff members'
          );
        }
        setStaff((data.staff as Staff[]) ?? []);
        setActorIsSuperAdmin(Boolean(data.actorIsSuperAdmin));
        return;
      } catch (apiError) {
        console.warn('Staff API load failed, trying client Firestore', apiError);
      }

      const [members, isSuper] = await Promise.all([
        getStaffMembers(),
        resolveActorIsSuperAdmin(email),
      ]);
      setStaff(members);
      setActorIsSuperAdmin(isSuper);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load staff members'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolveActorIsSuperAdmin]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) void loadStaff();
      else setLoading(false);
    });
    return unsubscribe;
  }, [loadStaff]);

  const pending = useMemo(() => staff.filter((s) => !s.active), [staff]);
  const active = useMemo(() => staff.filter((s) => s.active), [staff]);
  const admins = useMemo(
    () => staff.filter((s) => s.active && (s.role === 'admin' || s.isSuperAdmin)),
    [staff]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((member) => {
      if (filter === 'pending' && member.active) return false;
      if (filter === 'active' && !member.active) return false;
      if (filter === 'admins' && !(member.active && (member.role === 'admin' || member.isSuperAdmin))) {
        return false;
      }
      if (!q) return true;
      return (
        member.displayName.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        STAFF_ROLE_LABELS[member.role].toLowerCase().includes(q)
      );
    });
  }, [staff, filter, search]);

  const filteredPending = filtered.filter((s) => !s.active);
  const filteredActive = filtered.filter((s) => s.active);

  const patchStaff = async (
    member: Staff,
    updates: Partial<{
      role: StaffRole;
      active: boolean;
      isSuperAdmin: boolean;
    }>,
    successMessage: string
  ) => {
    setUpdatingId(member.id);
    try {
      const res = await adminFetch('/api/staff', {
        method: 'PATCH',
        body: JSON.stringify({
          staffId: member.id,
          displayName: member.displayName,
          role: updates.role ?? member.role,
          active: updates.active ?? member.active,
          isSuperAdmin:
            updates.isSuperAdmin !== undefined
              ? updates.isSuperAdmin
              : member.isSuperAdmin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      toast.success(successMessage);
      await loadStaff();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApprove = async (member: Staff) => {
    const role = roleDraft[member.id] ?? member.role ?? 'sales';
    await patchStaff(
      member,
      { role, active: true, isSuperAdmin: false },
      `${member.displayName} can now access the app`
    );
  };

  const handleRevoke = async (member: Staff) => {
    if (!confirm(`Revoke access for ${member.displayName || member.email}?`)) return;
    await patchStaff(member, { active: false, isSuperAdmin: false }, 'Access revoked');
    setExpandedId(null);
  };

  const handleRoleChange = async (member: Staff, role: StaffRole) => {
    await patchStaff(
      member,
      {
        role,
        isSuperAdmin: role === 'admin' ? Boolean(member.isSuperAdmin) : false,
      },
      `Role updated to ${STAFF_ROLE_LABELS[role]}`
    );
  };

  const handleMakeSuperAdmin = async (member: Staff) => {
    if (
      !confirm(
        `Make ${member.displayName} a Super Admin? They will be able to manage Admins and Super Admins.`
      )
    ) {
      return;
    }
    await patchStaff(
      member,
      { role: 'admin', active: true, isSuperAdmin: true },
      `${member.displayName} is now a Super Admin`
    );
  };

  const handleRemoveSuperAdmin = async (member: Staff) => {
    if (
      !confirm(
        `Remove Super Admin from ${member.displayName}? They will remain a regular Admin.`
      )
    ) {
      return;
    }
    await patchStaff(
      member,
      { role: 'admin', isSuperAdmin: false },
      'Super Admin status removed'
    );
  };

  const handleMakeAdmin = async (member: Staff) => {
    await patchStaff(
      member,
      { role: 'admin', isSuperAdmin: false },
      `${member.displayName} is now an Admin`
    );
  };

  const handleRemoveAdmin = async (member: Staff) => {
    await patchStaff(
      member,
      { role: 'manager', isSuperAdmin: false },
      `${member.displayName} demoted to Manager`
    );
  };

  const handleDelete = async (member: Staff) => {
    if (!confirm(`Remove ${member.email} from staff?`)) return;
    setUpdatingId(member.id);
    try {
      const res = await adminFetch(`/api/staff?id=${member.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete');
      toast.success('Staff member removed');
      await loadStaff();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove staff');
    } finally {
      setUpdatingId(null);
    }
  };

  const tabs: { id: StaffFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: staff.length },
    { id: 'pending', label: 'Pending', count: pending.length },
    { id: 'active', label: 'Active', count: active.length },
    { id: 'admins', label: 'Admins', count: admins.length },
  ];

  const kpiCards: {
    id: StaffFilter;
    label: string;
    value: number;
    icon: typeof Users;
  }[] = [
    { id: 'pending', label: 'Pending', value: pending.length, icon: UserPlus },
    { id: 'active', label: 'Active', value: active.length, icon: UserCheck },
    { id: 'admins', label: 'Admins', value: admins.length, icon: ShieldCheck },
    { id: 'all', label: 'Total', value: staff.length, icon: Users },
  ];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 rounded-2xl bg-slate-200/70 sm:h-44" />
        <div className="h-11 rounded-2xl bg-slate-200/60" />
        <div className="h-64 rounded-2xl bg-slate-200/50" />
      </div>
    );
  }

  return (
    <div className="relative isolate pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-16 -top-10 h-56 w-56 rounded-full bg-premium-blue/10 blur-3xl" />
        <div className="absolute -right-10 top-28 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-40 w-40 rounded-full bg-cyan/10 blur-3xl" />
      </div>

      {/* Hero */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0a4a7a] p-4 text-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] sm:mb-5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan/90 ring-1 ring-white/10">
              <Sparkles size={11} />
              Access control
            </div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">Staff Access</h1>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-300 sm:text-sm">
              Approve registrations, assign roles, and audit team activity
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              void loadStaff();
            }}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 touch-manipulation active:scale-[0.97]"
            aria-label="Refresh staff"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {kpiCards.map(({ id, label, value, icon: Icon }) => {
            const selected = filter === id;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-xl p-3 text-left ring-1 backdrop-blur transition touch-manipulation active:scale-[0.98] ${
                  selected
                    ? 'bg-white/20 ring-white/30'
                    : 'bg-white/10 ring-white/10 hover:bg-white/15'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    {label}
                  </p>
                  <Icon size={14} className="text-cyan/80" />
                </div>
                <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
              </button>
            );
          })}
        </div>
      </div>

      {!actorIsSuperAdmin && (
        <div className="mb-4 flex gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-3 text-xs leading-relaxed text-slate-600 shadow-sm backdrop-blur sm:px-4 sm:text-sm">
          <Shield size={18} className="mt-0.5 shrink-0 text-premium-blue" />
          <p>
            You can manage standard staff roles. Only a{' '}
            <span className="font-semibold text-slate-800">Super Admin</span> can promote or
            demote Admins and Super Admins.
          </p>
        </div>
      )}

      {/* Sticky filters — sit below the mobile app header */}
      <div className="sticky top-16 z-20 -mx-4 mb-4 space-y-3 border-b border-slate-200/60 bg-slate-50/95 px-4 py-3 backdrop-blur-md lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold touch-manipulation transition ${
                filter === tab.id
                  ? 'bg-gradient-to-r from-premium-blue to-cyan text-white shadow-[0_4px_16px_rgba(0,119,200,0.3)]'
                  : 'border border-slate-200/80 bg-white text-slate-600 shadow-sm hover:bg-white'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  filter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or role…"
            enterKeyHint="search"
            className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-premium-blue/40 focus:ring-4 focus:ring-premium-blue/10"
          />
        </div>
      </div>

      {/* Pending */}
      {(filter === 'all' || filter === 'pending') && (
        <section className="mb-5 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 via-white to-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3 border-b border-amber-100/80 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-bold text-amber-950 sm:text-base">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <UserPlus size={16} />
                </span>
                Pending approval
              </h2>
              <p className="mt-1 text-xs text-amber-800/70 sm:pl-10 sm:text-sm">
                New registrations waiting for access
              </p>
            </div>
            {filteredPending.length > 0 && (
              <span className="shrink-0 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">
                {filteredPending.length}
              </span>
            )}
          </div>

          <div className="p-3 sm:p-4">
            {filteredPending.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <UserCheck size={22} className="opacity-60" />
                </div>
                <p className="text-sm font-medium text-slate-500">No pending requests</p>
                <p className="text-xs text-slate-400">New sign-ups will appear here</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredPending.map((member) => {
                  const busy = updatingId === member.id;
                  return (
                    <li
                      key={member.id}
                      className="rounded-2xl border border-amber-100/90 bg-white p-3.5 shadow-sm sm:p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-bold text-white shadow-md ${avatarTone(member)}`}
                        >
                          {initials(member.displayName || member.email)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">
                            {member.displayName || 'Unnamed user'}
                          </p>
                          <p className="truncate text-xs text-slate-500 sm:text-sm">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                        <label className="sr-only" htmlFor={`role-${member.id}`}>
                          Assign role
                        </label>
                        <select
                          id={`role-${member.id}`}
                          value={roleDraft[member.id] ?? 'sales'}
                          onChange={(e) =>
                            setRoleDraft((prev) => ({
                              ...prev,
                              [member.id]: e.target.value as StaffRole,
                            }))
                          }
                          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-premium-blue/40 focus:ring-4 focus:ring-premium-blue/10"
                        >
                          {assignableRoles.map((role) => (
                            <option key={role} value={role}>
                              {STAFF_ROLE_LABELS[role]} — {ROLE_HINTS[role]}
                            </option>
                          ))}
                        </select>
                        <ActionButton
                          variant="primary"
                          disabled={busy}
                          onClick={() => void handleApprove(member)}
                        >
                          {busy ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Check size={16} />
                          )}
                          Grant access
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          disabled={busy}
                          onClick={() => void handleDelete(member)}
                        >
                          <Trash2 size={15} />
                          Reject
                        </ActionButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Active / admins roster */}
      {(filter === 'all' || filter === 'active' || filter === 'admins') && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Shield size={16} />
                </span>
                {filter === 'admins' ? 'Administrators' : 'Active staff'}
              </h2>
              <p className="mt-1 text-xs text-slate-500 sm:pl-10 sm:text-sm">
                {filteredActive.length} member{filteredActive.length === 1 ? '' : 's'} with
                console access
              </p>
            </div>
          </div>

          {filteredActive.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Users size={22} className="opacity-60" />
              </div>
              <p className="text-sm font-medium text-slate-500">No matching staff</p>
              <p className="text-xs text-slate-400">Try another filter or search</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredActive.map((member) => {
                const busy = updatingId === member.id;
                const locked =
                  !actorIsSuperAdmin &&
                  (member.role === 'admin' || Boolean(member.isSuperAdmin));
                const open = expandedId === member.id;
                const hasAdminActions =
                  actorIsSuperAdmin || (!locked && !member.isSuperAdmin);

                return (
                  <li key={member.id} className="px-3.5 py-4 sm:px-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-bold text-white shadow-md sm:h-12 sm:w-12 ${avatarTone(member)}`}
                      >
                        {initials(member.displayName || member.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <p className="max-w-full truncate font-semibold text-slate-900">
                            {member.displayName || 'Unnamed user'}
                          </p>
                          <RoleBadge member={member} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
                          {member.email}
                        </p>
                        <p className="mt-1 hidden text-xs text-slate-400 sm:block">
                          {ROLE_HINTS[member.role]}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className="sr-only" htmlFor={`active-role-${member.id}`}>
                        Change role
                      </label>
                      <select
                        id={`active-role-${member.id}`}
                        value={member.role}
                        disabled={busy || locked}
                        onChange={(e) =>
                          void handleRoleChange(member, e.target.value as StaffRole)
                        }
                        className="min-h-11 w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-60 focus:border-premium-blue/40 focus:ring-4 focus:ring-premium-blue/10 sm:min-h-10 sm:max-w-xs sm:py-2 sm:text-xs"
                      >
                        {assignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {STAFF_ROLE_LABELS[role]}
                          </option>
                        ))}
                        {!actorIsSuperAdmin && member.role === 'admin' && (
                          <option value="admin">Admin</option>
                        )}
                      </select>

                      {hasAdminActions && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((prev) =>
                              prev === member.id ? null : member.id
                            )
                          }
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 touch-manipulation sm:min-h-10"
                          aria-expanded={open}
                        >
                          Manage
                          <ChevronDown
                            size={14}
                            className={`transition ${open ? 'rotate-180' : ''}`}
                          />
                        </button>
                      )}
                    </div>

                    {open && hasAdminActions && (
                      <div className="mt-3 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {actorIsSuperAdmin &&
                          !member.isSuperAdmin &&
                          member.role !== 'admin' && (
                            <ActionButton
                              variant="blue"
                              disabled={busy}
                              onClick={() => void handleMakeAdmin(member)}
                            >
                              <Shield size={14} />
                              Make Admin
                            </ActionButton>
                          )}

                        {actorIsSuperAdmin &&
                          member.role === 'admin' &&
                          !member.isSuperAdmin && (
                            <ActionButton
                              disabled={busy}
                              onClick={() => void handleRemoveAdmin(member)}
                            >
                              <UserMinus size={14} />
                              Remove Admin
                            </ActionButton>
                          )}

                        {actorIsSuperAdmin && !member.isSuperAdmin && (
                          <ActionButton
                            variant="violet"
                            disabled={busy}
                            onClick={() => void handleMakeSuperAdmin(member)}
                          >
                            <Crown size={14} />
                            Make Super Admin
                          </ActionButton>
                        )}

                        {actorIsSuperAdmin && member.isSuperAdmin && (
                          <ActionButton
                            variant="violet"
                            disabled={busy}
                            onClick={() => void handleRemoveSuperAdmin(member)}
                          >
                            Remove Super Admin
                          </ActionButton>
                        )}

                        <ActionButton
                          disabled={busy || locked}
                          onClick={() => void handleRevoke(member)}
                        >
                          <X size={14} />
                          Revoke access
                        </ActionButton>
                      </div>
                    )}

                    {locked && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Only a Super Admin can change this account
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {actorIsSuperAdmin && (
        <div className="mt-5 sm:mt-6">
          <StaffActivityFeed enabled={actorIsSuperAdmin} />
        </div>
      )}
    </div>
  );
}

export default function StaffManagementPage() {
  return (
    <AdminGuard>
      <AdminLayout activeSection="staff">
        <StaffManagement />
      </AdminLayout>
    </AdminGuard>
  );
}
