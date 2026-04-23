import React, { useState, useEffect } from 'react';
import { History, RefreshCcw, User } from 'lucide-react';
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
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-[var(--bg-secondary)] transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm text-[var(--text-primary)]">
                          {log.action}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <User className="w-3.5 h-3.5" />
                          <span>{log.user || 'Unknown User'}</span>
                        </div>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] shrink-0 bg-[var(--bg-body)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown Time'}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap mt-1 border-l-2 border-[var(--border-focus)] pl-2">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
