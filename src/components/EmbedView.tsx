import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { EmbedDashboard } from '../types';
import { Plus, LayoutDashboard, ExternalLink, Trash2, Edit2, AlertCircle } from 'lucide-react';

interface EmbedViewProps {
  currentUser?: any;
}

export default function EmbedView({ currentUser }: EmbedViewProps) {
  const [embeds, setEmbeds] = useState<EmbedDashboard[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', url: '', type: 'other' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'embed_dashboards'), orderBy('created_at', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmbedDashboard[];
      setEmbeds(data);
      if (data.length > 0 && !activeTab) {
        setActiveTab(data[0].id);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.url) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'embed_dashboards', editingId), {
          ...formData,
          updated_at: serverTimestamp(),
        });
      } else {
        const docRef = await addDoc(collection(db, 'embed_dashboards'), {
          ...formData,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        setActiveTab(docRef.id);
      }
      setIsFormOpen(false);
      setFormData({ title: '', url: '', type: 'other' });
      setEditingId(null);
    } catch (error) {
      console.error("Error saving embed:", error);
      alert("Failed to save. Make sure you have the necessary permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this dashboard?")) {
      try {
        await deleteDoc(doc(db, 'embed_dashboards', id));
        if (activeTab === id) {
          setActiveTab(embeds.find(e => e.id !== id)?.id || null);
        }
      } catch (error) {
        console.error("Error deleting embed:", error);
      }
    }
  };

  const handleEdit = (embed: EmbedDashboard) => {
    setFormData({ title: embed.title, url: embed.url, type: embed.type });
    setEditingId(embed.id);
    setIsFormOpen(true);
  };

  const activeEmbed = embeds.find(e => e.id === activeTab);

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[var(--bg-primary)]">
      {/* Header Tabs */}
      <div className="flex items-center gap-2 p-4 border-b border-[var(--border-color)] overflow-x-auto bg-[var(--bg-surface)]">
        {embeds.map(embed => (
          <div key={embed.id} className="flex items-center group shrink-0">
            <button
              onClick={() => setActiveTab(embed.id)}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg transition-colors flex items-center gap-2 ${
                activeTab === embed.id 
                  ? 'bg-[var(--accent-color)] text-[var(--text-on-accent)]' 
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              {embed.title}
            </button>
            <div className={`flex items-center px-2 py-2 rounded-r-lg border-l border-[var(--border-color)] ${
              activeTab === embed.id ? 'bg-[var(--accent-color)] text-[var(--text-on-accent)] border-white/20' : 'bg-[var(--bg-secondary)]'
            }`}>
              <button onClick={() => handleEdit(embed)} className="p-1 hover:bg-black/10 rounded" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(embed.id)} className="p-1 hover:bg-black/10 rounded text-[var(--danger-color)]" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        
        <button
          onClick={() => {
            setFormData({ title: '', url: '', type: 'other' });
            setEditingId(null);
            setIsFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors shrink-0 border-dashed"
        >
          <Plus className="w-4 h-4" />
          Add Dashboard
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-[var(--bg-secondary)] overflow-hidden flex flex-col">
        {activeEmbed ? (
          <>
            <div className="flex items-center justify-between p-2 bg-[var(--bg-surface)] border-b border-[var(--border-color)] text-sm">
              <span className="text-[var(--text-muted)] truncate max-w-md" title={activeEmbed.url}>
                {activeEmbed.url}
              </span>
              <a
                href={activeEmbed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-md transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Buka di Tab Baru
              </a>
            </div>
            <iframe
              src={(() => {
                let finalUrl = activeEmbed.url;
                if (activeEmbed.type === 'looker' || finalUrl.includes('lookerstudio.google') || finalUrl.includes('datastudio.google')) {
                  // Re-map datastudio to lookerstudio to avoid redirect issues in iframes
                  finalUrl = finalUrl.replace('datastudio.google.com', 'lookerstudio.google.com');
                  
                  if (!finalUrl.includes('/embed/reporting/')) {
                    finalUrl = finalUrl.replace('/reporting/', '/embed/reporting/');
                  }
                }
                return finalUrl;
              })()}
              className="w-full h-full border-none flex-1"
              title={activeEmbed.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] space-y-4">
            <LayoutDashboard className="w-16 h-16 opacity-20" />
            <p>No dashboard selected. Add a new dashboard to get started.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)]">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {editingId ? 'Edit Dashboard' : 'Add New Dashboard'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  placeholder="e.g., Sales Dashboard (Looker)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Embed URL</label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full p-2 border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  placeholder="https://lookerstudio.google.com/embed/reporting/..."
                />
                <p className="text-xs text-[var(--text-muted)] mt-1.5 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Make sure to use the "Embed URL" (for Looker) or ensure the Google Site is published and allows embedding.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full p-2 border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                >
                  <option value="looker">Looker Studio</option>
                  <option value="google_sites">Google Sites</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)] mt-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-[var(--accent-color)] text-[var(--text-on-accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Save Dashboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
