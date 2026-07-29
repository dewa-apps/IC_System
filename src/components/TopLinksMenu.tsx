import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LinkIcon, ExternalLink, X, ChevronDown } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { DataListLink } from '../types';

export default function TopLinksMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [topLinks, setTopLinks] = useState<DataListLink[]>([]);
  const isDragging = React.useRef(false);

  useEffect(() => {
    const q = query(
      collection(db, 'data_list_link'),
      orderBy('clickCount', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const links: DataListLink[] = [];
      snapshot.forEach((doc) => {
        links.push({ id: doc.id, ...doc.data() } as DataListLink);
      });
      // Filter out those with no clicks or explicitly zero just to show relevant ones?
      // Or just take the top 10 as queried.
      setTopLinks(links);
    });

    return () => unsubscribe();
  }, []);

  const handleLinkClick = async (link: DataListLink) => {
    try {
      await updateDoc(doc(db, 'data_list_link', link.id), {
        clickCount: (link.clickCount || 0) + 1
      });
    } catch (e) {
      console.error("Failed to update click count", e);
    }
  };

  return (
    <div className="fixed bottom-6 left-20 z-[200]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 left-0 w-80 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-[var(--accent-color)]" />
                Top 10 Accessed Links
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {topLinks.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-muted)] italic">
                  No links available yet.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border-color)]">
                  {topLinks.map((link, index) => (
                    <li key={link.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                      <a 
                        href={link.link_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={() => handleLinkClick(link)}
                        className="block px-4 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-bold text-[var(--text-muted)] w-4 shrink-0 pt-0.5">
                            {index + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] mb-0.5">
                              <span className="truncate">{link.link_name}</span>
                              <ExternalLink className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                              {link.category && (
                                <span className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-1.5 py-0.5 rounded text-[10px] truncate max-w-[100px]">
                                  {link.category}
                                </span>
                              )}
                              <span>{link.clickCount || 0} views</span>
                            </div>
                          </div>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        drag
        dragMomentum={false}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={() => { 
          setTimeout(() => { isDragging.current = false; }, 200);
        }}
        onClick={(e) => {
          if (isDragging.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          setIsOpen(!isOpen);
        }}
        className="w-14 h-14 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] rounded-full shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-40"
        title="Top Links"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <LinkIcon className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
