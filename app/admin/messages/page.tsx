'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCheck,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Phone,
  RefreshCw,
  Reply,
  Search,
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

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-UG', {
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
      return 'bg-premium-blue/10 text-premium-blue ring-premium-blue/20';
    case 'read':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    case 'replied':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'archived':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
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

  const selected = filtered.find((m) => m.id === selectedId) ??
    messages.find((m) => m.id === selectedId) ??
    null;

  useEffect(() => {
    setNotes(selected?.adminNotes ?? '');
  }, [selected?.id, selected?.adminNotes]);

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
      setMessages((prev) =>
        prev.map((m) => (m.id === selected.id ? data.message : m))
      );
      if (status === 'new') {
        /* noop */
      }
      toast.success(
        status === 'replied'
          ? 'Marked as replied'
          : status === 'archived'
            ? 'Archived'
            : status === 'read'
              ? 'Marked as read'
              : 'Updated'
      );
      const countRes = await adminFetch('/api/messages?count=new');
      if (countRes.ok) {
        const countData = await countRes.json();
        setNewCount(countData.count ?? 0);
      }
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
        }
      } catch {
        /* ignore auto-read failures */
      }
    }
  };

  const replyMailto = () => {
    if (!selected) return;
    const href = getMailtoHref(selected.email, {
      subject: `Re: ${selected.subject} — MS Coatings`,
      body: `\n\n---\nOriginal message from ${selected.name} (${selected.email}):\n${selected.message}`,
    });
    window.location.href = href;
    void setStatus('replied');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                filter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.id === 'new' && newCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-premium-blue px-1 text-[10px] text-white">
                  {newCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, subject, message…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Inbox · {filtered.length} message{filtered.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                Loading messages…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <Inbox className="mx-auto mb-3 text-slate-300" size={28} />
                <p className="text-sm font-medium text-slate-600">No messages here</p>
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
                    className={`w-full px-4 py-3.5 text-left transition ${
                      active
                        ? 'bg-blue-50/80'
                        : m.status === 'new'
                          ? 'bg-sky-50/40 hover:bg-sky-50/70'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {m.status === 'new' ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-premium-blue" />
                          ) : (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-transparent" />
                          )}
                          <p
                            className={`truncate text-sm ${
                              m.status === 'new'
                                ? 'font-bold text-slate-900'
                                : 'font-medium text-slate-800'
                            }`}
                          >
                            {m.name}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate pl-4 text-xs text-slate-500">
                          {m.subject}
                        </p>
                        <p className="mt-1 line-clamp-1 pl-4 text-xs text-slate-400">
                          {m.message}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-slate-400">
                          {formatWhen(m.createdAt)}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset ${statusStyles(m.status)}`}
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

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selected ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <MailOpen size={26} />
              </div>
              <p className="font-semibold text-slate-800">Select a message</p>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                Choose a conversation from the inbox to read details and take action.
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] flex-col">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset ${statusStyles(selected.status)}`}
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
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      <Reply size={14} />
                      Reply
                    </button>
                    {selected.status !== 'read' && selected.status !== 'replied' && (
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => void setStatus('read')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <CheckCheck size={14} />
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => void setStatus('archived')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Archive size={14} />
                      Archive
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-premium-blue/10 text-premium-blue">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{selected.name}</p>
                    <a
                      href={`mailto:${selected.email}`}
                      className="flex items-center gap-1 truncate text-sm text-premium-blue hover:underline"
                    >
                      <Mail size={12} />
                      {selected.email}
                    </a>
                  </div>
                </div>
                {selected.phone && (
                  <a
                    href={`tel:${selected.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-premium-blue"
                  >
                    <Phone size={14} />
                    {selected.phone}
                  </a>
                )}
              </div>

              <div className="flex-1 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Message
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {selected.message}
                </p>

                <div className="mt-6">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Internal notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Private notes for your team…"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void setStatus(selected.status)}
                    className="mt-2 text-xs font-semibold text-premium-blue hover:underline disabled:opacity-60"
                  >
                    Save notes
                  </button>
                </div>
              </div>
            </div>
          )}
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
        <AdminLayout title="Messages" activeSection="messages">
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
        <AdminLayout title="Messages" activeSection="messages">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
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
      <AdminLayout
        activeSection="messages"
        title="Messages"
        subtitle="Contact form inbox — inquiries from the website."
      >
        <MessagesInbox />
      </AdminLayout>
    </AdminGuard>
  );
}
