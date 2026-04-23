import React, { useState, useEffect } from 'react';
import { History, RefreshCcw, User, PlusCircle, Pencil, Trash2, Info } from 'lucide-react';
import { ActivityLog } from '../types';
import { apiFetch } from '../apiInterceptor';

export default function AuditLogView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/activities');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Failed to fetch global activity logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getLogStyle = (action: string) => {
    const normalized = action.toLowerCase();
    if (normalized.includes('create') || normalized.includes('add') || normalized.includes('upload') || normalized.includes('import')) {
      return {
        bg: 'bg-green-50/40 dark:bg-green-900/10',
        badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50',
        icon: <PlusCircle className="w-4 h-4 text-green-600 dark:text-green-500" />
      };
    }
    if (normalized.includes('delete') || normalized.includes('remove') || normalized.includes('clear')) {
      return {
        bg: 'bg-red-50/40 dark:bg-red-900/10',
        badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50',
        icon: <Trash2 className="w-4 h-4 text-red-600 dark:text-red-500" />
      };
    }
    if (normalized.includes('update') || normalized.includes('edit') || normalized.includes('move') || normalized.includes('change') || normalized.includes('link') || normalized.includes('rename')) {
      return {
        bg: 'bg-blue-50/40 dark:bg-blue-900/10',
        badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50',
        icon: <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-500" />
      };
    }
    return {
      bg: 'bg-[var(--bg-surface)]',
      badge: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]',
      icon: <Info className="w-4 h-4 text-[var(--text-muted)]" />
    };
  };

  return (
    <main className="flex-1 p-6 overflow-auto bg-[var(--bg-body)]">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">System Audit Log</h2>
          </div>
          <button 
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)] transition-colors disabled:opacity-50"
            title="Refresh Logs"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          {loading && logs.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] animate-pulse">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] italic">No activity recorded yet.</div>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {logs.map((log) => {
                const style = getLogStyle(log.action);
                return (
                  <div key={log.id} className={`p-4 transition-colors ${style.bg} hover:brightness-95 dark:hover:brightness-110`}>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="mt-0.5 shrink-0 bg-[var(--bg-surface)] rounded-full p-1.5 shadow-sm border border-[var(--border-color)]">
                            {style.icon}
                          </div>
                          <div className="flex flex-col">
                            <span className={`font-semibold text-xs px-2 py-0.5 rounded border inline-block w-fit mb-1 ${style.badge}`}>
                              {log.action}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium">
                              <User className="w-3.5 h-3.5" />
                              <span>{log.user || 'Unknown User'}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-[var(--text-muted)] font-medium shrink-0 bg-[var(--bg-surface)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-sm">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown Time'}
                        </span>
                      </div>
                      {log.details && (
                        <div className="ml-10">
                          {log.details.includes('<') && log.details.includes('>') ? (
                             <div 
                               className="text-sm text-[var(--text-primary)] whitespace-pre-wrap ml-1 border-l-2 border-[var(--border-focus)] pl-3 py-0.5 opacity-90 prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-p:leading-tight prose-ul:my-0 prose-ol:my-0"
                               dangerouslySetInnerHTML={{ __html: log.details }}
                             />
                          ) : (
                            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap ml-1 border-l-2 border-[var(--border-focus)] pl-3 py-0.5 opacity-90">
                              {log.details}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
