import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, Inbox, Mail, MailOpen, RefreshCw, Search } from 'lucide-react';
import { adminFetch, API_BASE } from '@/lib/admin-api';
import {
  listContactMessagesClient,
  updateContactMessageClient,
  type ContactMessage,
  type ContactMessageStatus,
} from '@/lib/messages';
import { useOnline } from '@/hooks/useOnline';
import Panel from '@/components/Panel';
import { PageLoader } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

function formatWhen(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-UG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function bumpAlerts() {
  window.dispatchEvent(new Event('ms-alerts-refresh'));
}

export default function MessagesPage() {
  const online = useOnline();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ContactMessageStatus>('all');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [source, setSource] = useState<'api' | 'firestore'>('api');

  const load = async () => {
    try {
      if (online) {
        try {
          const res = await adminFetch('/api/messages?status=all');
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(
              typeof data.error === 'string' ? data.error : `HTTP ${res.status}`
            );
          }
          const apiMessages = (data.messages as ContactMessage[]) ?? [];
          setMessages(apiMessages);
          setSource('api');
          // Keep IndexedDB warm so Messages still works after going offline.
          void import('@/lib/offline/local-store').then(({ localSet }) =>
            localSet('contactMessages', {
              items: apiMessages,
              savedAt: Date.now(),
            })
          );
          bumpAlerts();
          return;
        } catch (apiError) {
          console.warn('Messages API unavailable, using Firestore', apiError);
        }
      }

      const local = await listContactMessagesClient('all');
      setMessages(local);
      setSource('firestore');
      bumpAlerts();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load messages'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    setNotes(selected?.adminNotes ?? '');
  }, [selected?.id, selected?.adminNotes]);

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
        (m.phone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [messages, filter, search]);

  const patchStatus = async (
    id: string,
    status: ContactMessageStatus,
    adminNotes?: string
  ) => {
    try {
      try {
        const res = await adminFetch(`/api/messages/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            ...(adminNotes !== undefined ? { adminNotes } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.error === 'string' ? data.error : `HTTP ${res.status}`
          );
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? (data.message as ContactMessage) : m))
        );
        bumpAlerts();
        return true;
      } catch {
        const updated = await updateContactMessageClient(id, {
          status,
          ...(adminNotes !== undefined ? { adminNotes } : {}),
        });
        setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
        bumpAlerts();
        return true;
      }
    } catch {
      toast.error('Could not update message');
      return false;
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    try {
      try {
        const res = await adminFetch(`/api/messages/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ adminNotes: notes }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.error === 'string' ? data.error : `HTTP ${res.status}`
          );
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === selected.id ? (data.message as ContactMessage) : m
          )
        );
      } catch {
        const updated = await updateContactMessageClient(selected.id, {
          adminNotes: notes,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === selected.id ? updated : m))
        );
      }
      toast.success('Notes saved');
    } catch {
      toast.error('Could not save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const selectMessage = async (msg: ContactMessage) => {
    setSelectedId(msg.id);
    if (msg.status === 'new') {
      await patchStatus(msg.id, 'read');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Messages</h1>
          <p className="mt-1 text-slate-500">
            Contact form inbox from the website
            {!online
              ? ' · offline cache'
              : source === 'firestore'
                ? ' · synced via Firestore'
                : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {online && (
            <button
              type="button"
              onClick={() => window.open(`${API_BASE}/admin/messages`, '_blank')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open in browser
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {(['all', 'new', 'read', 'replied', 'archived'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium capitalize',
              filter === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Inbox" subtitle={`${filtered.length} messages`} className="lg:col-span-2">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No messages</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((msg) => (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => void selectMessage(msg)}
                    className={cn(
                      'flex w-full items-start gap-3 px-1 py-3 text-left transition hover:bg-slate-50',
                      selectedId === msg.id && 'bg-blue-50'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 rounded-lg p-2',
                        msg.status === 'new'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {msg.status === 'new' ? <Mail size={16} /> : <MailOpen size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-900">{msg.name}</span>
                        {msg.status === 'new' && (
                          <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            NEW
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-slate-600">
                        {msg.subject}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {formatWhen(msg.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={selected ? selected.subject : 'Select a message'}
          subtitle={selected ? `${selected.name} · ${selected.email}` : 'Pick from the inbox'}
          className="lg:col-span-3"
        >
          {!selected ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <Inbox size={32} />
              <p className="text-sm">No message selected</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <a
                  href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Reply
                </a>
                {selected.status !== 'replied' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await patchStatus(selected.id, 'replied', notes);
                      if (ok) toast.success('Marked as replied');
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Mark replied
                  </button>
                )}
                {selected.status !== 'archived' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await patchStatus(selected.id, 'archived');
                      if (ok) toast.success('Archived');
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Archive size={16} />
                    Archive
                  </button>
                )}
              </div>
              {selected.phone && (
                <p className="text-sm text-slate-500">Phone: {selected.phone}</p>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {selected.message}
              </p>

              <div className="border-t border-slate-100 pt-4">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Admin notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => void saveNotes()}
                  disabled={savingNotes}
                  className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingNotes ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
