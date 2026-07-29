import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Link as LinkIcon, CalendarDays, Hash, Settings, BarChart3, History, FileText, CheckSquare, List } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (viewMode: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger handled in parent
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const commands = [
    { id: 'board', name: 'Task Board', icon: CheckSquare },
    { id: 'gantt', name: 'Gantt Chart', icon: BarChart3 },
    { id: 'data-list-link', name: 'Data List Link', icon: LinkIcon },
    { id: 'data-list-jadwal', name: 'Data List Jadwal', icon: CalendarDays },
    { id: 'data-list-klaim', name: 'Data List Klaim', icon: Hash },
    { id: 'data-list-warehouse', name: 'Data List Warehouse', icon: List },
    { id: 'reports', name: 'Reports', icon: FileText },
    { id: 'audit', name: 'Audit Log', icon: History },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (id: string) => {
    onNavigate(id);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[90%] max-w-xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl z-[301] overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
              <Search className="w-5 h-5 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] text-lg"
              />
              <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-medium bg-[var(--bg-secondary)] px-2 py-1 rounded">
                <span>esc</span>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filteredCommands.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <div className="px-2 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    Navigation
                  </div>
                  {filteredCommands.map((cmd, index) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd.id)}
                      className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-[var(--bg-secondary)] rounded-lg transition-colors group"
                    >
                      <cmd.icon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{cmd.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-[var(--text-muted)] text-sm">
                  No results found for "{query}"
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
