'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CheckCheck,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Phone,
  RefreshCw,
  Reply,
  Search,
  Sparkles,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { adminFetch } from '@/lib/admin-api';
import type { ContactMessage, ContactMessageStatus } from '@/lib/erp-types';
import { getMailtoHref } from '@/lib/seo/business';

type FilterTab = 'all' | ContactMessageStatus;

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'read', label: 'Read' },
  { id: 'replied', label: 'Replied' },
  { id: 'archived', label: 'Archived' },
];

function formatWhen(iso: string, compact = false) {
  const date = new Date(iso);
  if (compact) {
    const now = Date.now();
    const diff = now - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusStyles(status: ContactMessageStatus) {
  switch (status) {
    case 'new':
      return 'bg-premium-blue/10 text-premium-blue ring-premium-blue/25';
    case 'read':
      return 'bg-slate-100/90 text-slate-600 ring-slate-200/80';
    case 'replied':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200/80';
    case 'archived':
      return 'bg-amber-50 text-amber-700 ring-amber-200/80';
  }
}

function initialOf(name: string) {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function MessagesInbox() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/messages?status=all');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setMessages(data.messages ?? []);
      setNewCount(data.newCount ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter !== 'all' && m.status !== filter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q)
      );
    });
  }, [messages, filter, search]);

  const selected =
    filtered.find((m) => m.id === selectedId) ??
    messages.find((m) => m.id === selectedId) ??
    null;

  useEffect(() => {
    setNotes(selected?.adminNotes ?? '');
  }, [selected?.id, selected?.adminNotes]);

  const refreshNewCount = async () => {
    const countRes = await adminFetch('/api/messages?count=new');
    if (countRes.ok) {
      const countData = await countRes.json();
      setNewCount(countData.count ?? 0);
    }
  };

  const setStatus = async (status: ContactMessageStatus) => {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await adminFetch(`/api/messages/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNotes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setMessages((prev) => prev.map((m) => (m.id === selected.id ? data.message : m)));
      toast.success(
        status === 'replied'
          ? 'Marked as replied'
          : status === 'archived'
            ? 'Archived'
            : status === 'read'
              ? 'Marked as read'
              : 'Updated'
      );
      await refreshNewCount();
      window.dispatchEvent(new Event('ms-alerts-refresh'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const openMessage = async (message: ContactMessage) => {
    setSelectedId(message.id);
    if (message.status === 'new') {
      try {
        const res = await adminFetch(`/api/messages/${message.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'read' }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessages((prev) =>
            prev.map((m) => (m.id === message.id ? data.message : m))
          );
          setNewCount((c) => Math.max(0, c - 1));
          window.dispatchEvent(new Event('ms-alerts-refresh'));
        }
      } catch {
        /* ignore auto-read failures */
      }
    }
  };

  const closeDetail = () => setSelectedId(null);

  const replyMailto = () => {
    if (!selected) return;
    const href = getMailtoHref(selected.email, {
      subject: `Re: ${selected.subject} — MS Coatings`,
      body: `\n\n---\nOriginal message from ${selected.name} (${selected.email}):\n${selected.message}`,
    });
    window.location.href = href;
    void setStatus('replied');
  };

  const repliedCount = messages.filter((m) => m.status === 'replied').length;
  const showList = !selected;
  const showDetail = Boolean(selected);

  return (
    <div className="relative isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-16 -top-10 h-56 w-56 rounded-full bg-premium-blue/10 blur-3xl" />
        <div className="absolute -right-10 top-24 h-48 w-48 rounded-full bg-cyan/10 blur-3xl" />
      </div>

      {/* Hero strip */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0a4a7a] p-4 text-white shadow-lg sm:mb-5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan/90 ring-1 ring-white/10">
              <Sparkles size={11} />
              Contact inbox
            </div>
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">
              Website inquiries
            </h2>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              Messages from the public contact form
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 touch-manipulation"
            aria-label="Refresh messages"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              New
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">{newCount}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              Total
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">
              {messages.length}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              Replied
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">
              {repliedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Filters + search — hide on mobile when reading a message */}
      <div
        className={`mb-4 space-y-3 ${showDetail ? 'hidden lg:block' : ''}`}
      >
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`inline-flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold touch-manipulation transition sm:py-2 ${
                filter === tab.id
                  ? 'bg-gradient-to-r from-premium-blue to-cyan text-white shadow-[0_4px_16px_rgba(0,119,200,0.3)]'
                  : 'border border-slate-200/80 bg-white/80 text-slate-600 shadow-sm hover:bg-white'
              }`}
            >
              {tab.label}
              {tab.id === 'new' && newCount > 0 && (
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    filter === tab.id
                      ? 'bg-white/25 text-white'
                      : 'bg-premium-blue text-white'
                  }`}
                >
                  {newCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, subject…"
            className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-white/90 py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none transition focus:border-premium-blue/40 focus:ring-2 focus:ring-premium-blue/15 sm:min-h-0"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-5">
        {/* List */}
        <div
          className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm ${
            showList ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Inbox · {filtered.length}
            </p>
            {newCount > 0 && (
              <span className="rounded-full bg-premium-blue/10 px-2 py-0.5 text-[10px] font-bold text-premium-blue">
                {newCount} unread
              </span>
            )}
          </div>

          <div className="max-h-[min(70vh,720px)] divide-y divide-slate-100/80 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                Loading messages…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-20 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                  <Inbox size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-700">No messages here</p>
                <p className="mt-1 text-xs text-slate-400">
                  Contact form submissions will appear in this inbox.
                </p>
              </div>
            ) : (
              filtered.map((m) => {
                const active = selectedId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void openMessage(m)}
                    className={`flex w-full gap-3 px-3.5 py-3.5 text-left touch-manipulation transition sm:px-4 ${
                      active
                        ? 'bg-gradient-to-r from-premium-blue/[0.08] to-cyan/[0.05]'
                        : m.status === 'new'
                          ? 'bg-sky-50/50 hover:bg-sky-50/80'
                          : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        m.status === 'new'
                          ? 'bg-gradient-to-br from-premium-blue to-cyan text-white shadow-md shadow-premium-blue/25'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {initialOf(m.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`truncate text-sm ${
                            m.status === 'new'
                              ? 'font-bold text-slate-900'
                              : 'font-semibold text-slate-800'
                          }`}
                        >
                          {m.name}
                        </p>
                        <p className="shrink-0 text-[10px] tabular-nums text-slate-400">
                          {formatWhen(m.createdAt, true)}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-600">
                        {m.subject}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-[11px] text-slate-400">
                          {m.message}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${statusStyles(m.status)}`}
                        >
                          {m.status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail — full takeover on mobile */}
        <div
          className={`${
            showDetail
              ? 'fixed inset-0 z-[60] flex flex-col bg-slate-50 lg:static lg:z-auto lg:block lg:bg-transparent'
              : 'hidden lg:block'
          }`}
        >
          <div
            className={`flex h-full min-h-0 flex-col overflow-hidden border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] lg:min-h-[520px] lg:rounded-2xl lg:border ${
              showDetail ? 'rounded-none border-0' : ''
            }`}
          >
            {!selected ? (
              <div className="hidden h-full min-h-[520px] flex-col items-center justify-center px-6 text-center lg:flex">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-premium-blue/15 to-cyan/15 text-premium-blue ring-1 ring-premium-blue/15">
                  <MailOpen size={28} />
                </div>
                <p className="text-base font-semibold text-slate-800">Select a message</p>
                <p className="mt-1.5 max-w-xs text-sm text-slate-500">
                  Choose a conversation from the inbox to read details and respond.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile top bar */}
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden">
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 touch-manipulation"
                    aria-label="Back to inbox"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {selected.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{selected.subject}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ring-1 ring-inset ${statusStyles(selected.status)}`}
                  >
                    {selected.status}
                  </span>
                </div>

                <div className="hidden border-b border-slate-100 px-5 py-4 lg:block">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ring-1 ring-inset ${statusStyles(selected.status)}`}
                      >
                        {selected.status}
                      </span>
                      <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900">
                        {selected.subject}
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Received {formatWhen(selected.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updating}
                        onClick={replyMailto}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-premium-blue to-cyan px-3.5 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(0,119,200,0.3)] disabled:opacity-60"
                      >
                        <Reply size={14} />
                        Reply
                      </button>
                      {selected.status !== 'read' && selected.status !== 'replied' && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => void setStatus('read')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <CheckCheck size={14} />
                          Mark read
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => void setStatus('archived')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <Archive size={14} />
                        Archive
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain pb-28 lg:pb-5">
                  <div className="space-y-4 border-b border-slate-100 px-4 py-4 sm:px-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-premium-blue/15 to-cyan/15 text-sm font-bold text-premium-blue ring-1 ring-premium-blue/15">
                        {initialOf(selected.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{selected.name}</p>
                        <a
                          href={`mailto:${selected.email}`}
                          className="mt-0.5 flex items-center gap-1 truncate text-sm text-premium-blue hover:underline"
                        >
                          <Mail size={12} className="shrink-0" />
                          <span className="truncate">{selected.email}</span>
                        </a>
                      </div>
                    </div>
                    {selected.phone && (
                      <a
                        href={`tel:${selected.phone}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-50 px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200/80 hover:text-premium-blue touch-manipulation"
                      >
                        <Phone size={14} />
                        {selected.phone}
                      </a>
                    )}
                    <p className="text-[11px] text-slate-400 lg:hidden">
                      Received {formatWhen(selected.createdAt)}
                    </p>
                    <h3 className="text-base font-bold text-slate-900 lg:hidden">
                      {selected.subject}
                    </h3>
                  </div>

                  <div className="px-4 py-5 sm:px-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Message
                    </p>
                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {selected.message}
                      </p>
                    </div>

                    <div className="mt-6">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                        Internal notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Private notes for your team…"
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-premium-blue/40 focus:ring-2 focus:ring-premium-blue/15"
                      />
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => void setStatus(selected.status)}
                        className="mt-2 min-h-10 text-xs font-semibold text-premium-blue hover:underline disabled:opacity-60 touch-manipulation"
                      >
                        Save notes
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sticky mobile actions */}
                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
                  <div className="mx-auto flex max-w-lg gap-2">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={replyMailto}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-premium-blue to-cyan text-sm font-semibold text-white shadow-[0_4px_16px_rgba(0,119,200,0.3)] disabled:opacity-60 touch-manipulation"
                    >
                      <Reply size={16} />
                      Reply
                    </button>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => void setStatus('archived')}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 touch-manipulation"
                      aria-label="Archive"
                    >
                      <Archive size={16} />
                    </button>
                    {selected.status !== 'read' && selected.status !== 'replied' && (
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => void setStatus('read')}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 touch-manipulation"
                        aria-label="Mark read"
                      >
                        <CheckCheck size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  const { can, loading } = usePermissions();

  if (loading) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="messages">
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  if (!can('viewMessages')) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="messages" title="Messages">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-10 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <User size={22} />
            </div>
            <p className="font-semibold text-slate-800">Access restricted</p>
            <p className="mt-1 text-sm text-slate-500">
              You do not have permission to view contact messages.
            </p>
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout activeSection="messages">
        <MessagesInbox />
      </AdminLayout>
    </AdminGuard>
  );
}
