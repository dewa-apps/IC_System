import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, LinkIcon, X, Plus, Layers } from 'lucide-react';
import ChatWidget from './ChatWidget';
import TopLinksMenu from './TopLinksMenu';

interface FloatingWidgetMenuProps {
  chatProps: any;
}

export default function FloatingWidgetMenu({ chatProps }: FloatingWidgetMenuProps) {
  const [activeWidget, setActiveWidget] = useState<'chat' | 'topLinks' | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDragging = useRef(false);

  const toggleMenu = (e: React.MouseEvent) => {
    if (isDragging.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setIsMenuOpen(!isMenuOpen);
  };

  const openWidget = (widget: 'chat' | 'topLinks') => {
    setActiveWidget(widget);
    setIsMenuOpen(false);
  };

  return (
    <>
      <motion.div 
        className="fixed bottom-6 right-6 z-[200]"
        drag
        dragMomentum={false}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={() => { 
          setTimeout(() => { isDragging.current = false; }, 200);
        }}
      >
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-16 right-0 flex flex-col gap-2 mb-2"
            >
              <button
                onClick={() => openWidget('topLinks')}
                className="flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-color)] px-4 py-2.5 rounded-full shadow-lg hover:bg-[var(--bg-secondary)] transition-colors whitespace-nowrap text-sm font-medium text-[var(--text-primary)]"
              >
                <LinkIcon className="w-4 h-4 text-[var(--accent-color)]" />
                Top Links
              </button>
              <button
                onClick={() => openWidget('chat')}
                className="flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-color)] px-4 py-2.5 rounded-full shadow-lg hover:bg-[var(--bg-secondary)] transition-colors whitespace-nowrap text-sm font-medium text-[var(--text-primary)]"
              >
                <MessageSquare className="w-4 h-4 text-[var(--accent-color)]" />
                AI Assistant
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={toggleMenu}
          className="w-14 h-14 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] rounded-full shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-40"
          title="Widgets Menu"
        >
          <AnimatePresence mode="wait">
            {isMenuOpen || activeWidget ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Layers className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </motion.div>

      <ChatWidget 
        isOpen={activeWidget === 'chat'} 
        onClose={() => setActiveWidget(null)} 
        {...chatProps} 
      />
      <TopLinksMenu 
        isOpen={activeWidget === 'topLinks'} 
        onClose={() => setActiveWidget(null)} 
      />
    </>
  );
}
