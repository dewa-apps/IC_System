import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LinkIcon, ExternalLink, X, ChevronDown } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { DataListLink } from '../types';

interface TopLinksMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TopLinksMenu({ isOpen, onClose }: TopLinksMenuProps) {
  const [topLinks, setTopLinks] = useState<DataListLink[]>([]);

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
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-80 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden flex flex-col z-[200]"
          >
            <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-[var(--accent-color)]" />
                Top 10 Accessed Links
              </h3>
              <button 
                onClick={onClose}
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

    </>
  );
}
