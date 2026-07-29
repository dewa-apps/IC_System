import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Edit3, X, Maximize2, Minimize2, Trash2 } from 'lucide-react';

interface QuickNotesProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickNotes({ isOpen, onClose }: QuickNotesProps) {
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const isDragging = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('ic_quick_notes');
    if (saved) setNote(saved);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
    localStorage.setItem('ic_quick_notes', e.target.value);
  };

  const clearNote = () => {
    if (window.confirm('Clear all notes?')) {
      setNote('');
      localStorage.removeItem('ic_quick_notes');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`fixed bottom-24 right-20 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col z-[201] transition-all duration-300 ${
            isExpanded ? 'w-[500px] h-[600px]' : 'w-80 h-96'
          }`}
        >
          <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between cursor-move"
               onMouseDown={() => { isDragging.current = true; }}
               onMouseUp={() => { isDragging.current = false; }}
          >
            <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--text-primary)]">
              <Edit3 className="w-4 h-4 text-[var(--accent-color)]" />
              Quick Notes
            </h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={clearNote}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--danger-color)] hover:bg-[var(--danger-color)]/10 rounded transition-colors"
                title="Clear Notes"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={onClose}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-0 flex flex-col bg-[var(--bg-surface)] relative group">
            <textarea
              value={note}
              onChange={handleChange}
              placeholder="Jot down something quick..."
              className="flex-1 w-full h-full p-4 bg-transparent border-none outline-none resize-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] leading-relaxed"
              autoFocus
            />
          </div>
          <div className="px-4 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex justify-between items-center text-[10px] text-[var(--text-muted)] font-medium">
            <span>{note.length} characters</span>
            <span>Saved locally</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
