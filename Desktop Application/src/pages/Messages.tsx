import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, Inbox, Mail, MailOpen, RefreshCw } from 'lucide-react';
import { adminFetch, API_BASE } from '@/lib/admin-api';
import { useOnline } from '@/hooks/useOnline';
import Panel from '@/components/Panel';
import { PageLoader } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived' | 'replied';
  createdAt?: string;
};

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
  const [filter, setFilter] = useState<'all' | 'new' | 'read' | 'archived'>('all');

  const load = async () => {
    if (!online) {
      setLoading(false);
      return;
    }
    try {
      const res = await adminFetch('/api/messages');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMessages(data.messages ?? []);
      bumpAlerts();
    } catch {
      toast.error('Could not load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const filtered = messages.filter((m) => (filter === 'all' ? true : m.status === filter));

  const patchStatus = async (id: string, status: ContactMessage['status']) => {
    try {
      const res = await adminFetch(`/api/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === id ? data.message : m)));
      bumpAlerts();
      return true;
    } catch {
      toast.error('Could not update message');
      return false;
    }
  };

  const selectMessage = async (msg: ContactMessage) => {
    setSelectedId(msg.id);
    if (msg.status === 'new') {
      await patchStatus(msg.id, 'read');
    }
  };

  if (loading) return <PageLoader />;

  if (!online) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Messages</h1>
        <p className="text-slate-500">Connect to the internet to view contact messages.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Messages</h1>
          <p className="mt-1 text-slate-500">Contact form inbox from the website</p>
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
          <button
            type="button"
            onClick={() => window.open(`${API_BASE}/admin/messages`, '_blank')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open in browser
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {(['all', 'new', 'read', 'archived'] as const).map((key) => (
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
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
