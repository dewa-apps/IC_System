import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { DataListLink } from '../types';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Plus, Trash2, Edit2, ExternalLink, ChevronUp, ChevronDown, ListIcon, X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

export interface DataListLinkViewRef {
  openAddModal: () => void;
}

interface DataListLinkViewProps {
  dataLinks: DataListLink[];
  categories: string[];
  searchQuery: string;
}

const DataListLinkView = forwardRef<DataListLinkViewRef, DataListLinkViewProps>(({ dataLinks, categories, searchQuery }, ref) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // Sort
  const [sortField, setSortField] = useState<keyof DataListLink>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Resizing
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>({
    display_id: 100,
    category: 150,
    link_name: 200,
    description: 300,
    note: 200
  });
  const [resizingCol, setResizingCol] = useState<{ key: string, startX: number, startWidth: number } | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<DataListLink | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    link_name: '',
    link_url: '',
    description: '',
    note: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (!window.confirm('Are you sure you want to import data? This will create multiple records.')) return;
    
    setIsImporting(true);
    try {
      const csvText = (await import('../data/links.csv?raw')).default;
      
      const rows = csvText.split('\n').filter(r => r.trim());
      const headerObj = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const recordsToInsert = [];
      const newCategories = new Set<string>();

      for (let i = 1; i < rows.length; i++) {
        // Simple manual split that ignores commas inside quotes
        let inQuotes = false;
        let currentValue = '';
        const values = [];
        
        for (let j = 0; j < rows[i].length; j++) {
          const char = rows[i][j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue);

        while(values.length < headerObj.length) values.push('');

        const category = values[0]?.trim() || '';
        const link_name = values[1]?.trim() || '';
        const link_url = values[2]?.trim() || '';
        const description = values[3]?.trim()?.replace(/^"|"$/g, '') || '';
        const note = values[4]?.trim()?.replace(/^"|"$/g, '') || '';

        if (!link_name || !link_url) continue;

        let nextNum = 1;
        if (category) {
          const catInitial = category.charAt(0).toUpperCase();
          const existingSameCat = dataLinks.filter(l => l.category && l.display_id && l.category.charAt(0).toUpperCase() === catInitial);
          const newSameCat = recordsToInsert.filter(l => l.category && l.category.charAt(0).toUpperCase() === catInitial);
          let maxNum = 0;
          for (const l of [...existingSameCat, ...newSameCat]) {
             if (l.display_id && l.display_id.startsWith(`${catInitial}-`)) {
               const numStr = l.display_id.split('-')[1];
               const num = parseInt(numStr, 10);
               if (!isNaN(num) && num > maxNum) {
                 maxNum = num;
               }
             }
          }
          nextNum = maxNum + 1;
        }

        const newDisplayId = category ? `${category.charAt(0).toUpperCase()}-${nextNum.toString().padStart(3, '0')}` : '';

        if (category) newCategories.add(category);

        recordsToInsert.push({
          category,
          link_name,
          link_url,
          description,
          note,
          display_id: newDisplayId
        });
      }

      for (const record of recordsToInsert) {
        await addDoc(collection(db, 'data_list_link'), {
          ...record,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
      }

      if (newCategories.size > 0) {
         try {
           await setDoc(doc(db, 'metadata', 'dropdowns'), {
             category_link: arrayUnion(...Array.from(newCategories))
           }, { merge: true });
         } catch (err) {
           console.error("Failed to update metadata categories", err);
         }
      }

      toast.success(`Successfully imported ${recordsToInsert.length} links!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

  // Handlers for resizing
  const handleResizeStart = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol({ key, startX: e.clientX, startWidth: colWidths[key] });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCol) return;
      const diff = e.clientX - resizingCol.startX;
      const newWidth = Math.max(50, resizingCol.startWidth + diff);
      setColWidths(prev => ({ ...prev, [resizingCol.key]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    if (resizingCol) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  const onSort = (field: keyof DataListLink) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: keyof DataListLink }) => {
    if (sortField !== field) return <div className="w-3" />;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const filteredLinks = useMemo(() => {
    let filtered = [...dataLinks];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        (l.link_name || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.note || '').toLowerCase().includes(q) ||
        (l.category || '').toLowerCase().includes(q)
      );
    }
    if (selectedCategory) {
      filtered = filtered.filter(l => l.category === selectedCategory);
    }

    filtered.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
    });

    return filtered;
  }, [dataLinks, searchQuery, selectedCategory, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredLinks.length / rowsPerPage);
  const paginatedLinks = filteredLinks.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const openAddModal = () => {
    setEditingLink(null);
    setShowDeleteConfirm(false);
    setFormData({ category: '', link_name: '', link_url: '', description: '', note: '' });
    setIsModalOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openAddModal
  }));

  const openEditModal = (link: DataListLink) => {
    setEditingLink(link);
    setShowDeleteConfirm(false);
    setFormData({
      category: link.category || '',
      link_name: link.link_name || '',
      link_url: link.link_url || '',
      description: link.description || '',
      note: link.note || ''
    });
    setIsModalOpen(true);
  };

  const saveLink = async () => {
    if (!formData.link_name || !formData.link_url) {
      toast.error('Link Name and URL are required');
      return;
    }
    if (!formData.category) {
      toast.error('Category is required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingLink) {
        await updateDoc(doc(db, 'data_list_link', editingLink.id), {
          ...formData,
          updated_at: serverTimestamp()
        });
        toast.success('Link updated successfully');
      } else {
        // Generate display_id
        let newDisplayId = '';
        if (formData.category) {
          const catInitial = formData.category.charAt(0).toUpperCase();
          const sameCatLinks = dataLinks.filter(l => l.category && l.display_id && l.category.charAt(0).toUpperCase() === catInitial);
          
          let maxNum = 0;
          for (const l of sameCatLinks) {
             if (typeof l.display_id === 'string' && l.display_id.startsWith(`${catInitial}-`)) {
               const numStr = l.display_id.split('-')[1];
               const num = parseInt(numStr, 10);
               if (!isNaN(num) && num > maxNum) {
                 maxNum = num;
               }
             }
          }
          const nextNum = maxNum + 1;
          newDisplayId = `${catInitial}-${nextNum.toString().padStart(3, '0')}`;
        }

        await addDoc(collection(db, 'data_list_link'), {
          ...formData,
          display_id: newDisplayId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        toast.success('Link created successfully');
      }

      // Add category to metadata dropdowns
      if (formData.category) {
        try {
          await setDoc(doc(db, 'metadata', 'dropdowns'), {
            category_link: arrayUnion(formData.category.trim())
          }, { merge: true });
        } catch (err) {
          console.error("Failed to update metadata options", err);
        }
      }

      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save link');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'data_list_link', id));
      toast.success('Link deleted successfully');
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete link');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-[var(--bg-body)] h-full overflow-hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
        <select
          className="px-3 py-2 bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] text-sm shrink-0 min-w-[200px]"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.filter(Boolean).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button 
          onClick={handleImport}
          disabled={isImporting}
          className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {isImporting ? 'Importing...' : 'Import Data'}
        </button>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg overflow-hidden shadow-sm flex flex-col flex-1 transition-colors duration-200">
        <div className={`overflow-auto flex-1 ${resizingCol ? 'select-none' : ''}`}>
          <table className="w-max min-w-full text-left border-collapse whitespace-nowrap relative table-fixed" style={{ width: Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] shadow-sm">
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('id')}
                  style={{ width: colWidths.display_id }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    ID <SortIcon field="id" />
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'display_id')} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('category')}
                  style={{ width: colWidths.category }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Category <SortIcon field="category" />
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'category')} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('link_name')}
                  style={{ width: colWidths.link_name }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Link Name <SortIcon field="link_name" />
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'link_name')} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('description')}
                  style={{ width: colWidths.description }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Description <SortIcon field="description" />
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'description')} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('note')}
                  style={{ width: colWidths.note }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Note <SortIcon field="note" />
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'note')} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {paginatedLinks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    No links found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedLinks.map((link) => (
                  <tr 
                    key={link.id} 
                    className="hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors group"
                    onClick={() => openEditModal(link)}
                  >
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)] font-mono truncate">{link.display_id || link.id.substring(0, 6)}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)] truncate">{link.category}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--accent-color)] truncate">
                      <a href={link.link_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:underline flex items-center gap-1.5 w-full whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="truncate">{link.link_name}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate" title={link.description}>{link.description}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate" title={link.note}>{link.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="border-t border-[var(--border-color)] px-4 py-3 flex items-center justify-between bg-[var(--bg-surface)]">
            <span className="text-sm text-[var(--text-secondary)]">
              Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredLinks.length)} of {filteredLinks.length} entries
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] disabled:opacity-50 text-[var(--text-primary)]"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] disabled:opacity-50 text-[var(--text-primary)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-[var(--text-primary)]" onClick={() => !isSaving && setIsModalOpen(false)}>
          <div 
            className="bg-[var(--bg-surface)] w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-[var(--border-color)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-primary)]">
              <h3 className="text-lg font-bold">{editingLink ? 'Edit Link' : 'Add New Link'}</h3>
              <div className="flex items-center gap-2">
                {editingLink && (
                  <>
                    {!showDeleteConfirm ? (
                       <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete Link"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-sm font-medium text-red-500">Delete link?</span>
                        <button 
                          onClick={() => handleDelete(editingLink.id)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          Yes
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-xs border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] disabled:opacity-50 text-[var(--text-primary)]"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button onClick={() => !isSaving && !isDeleting && setIsModalOpen(false)} className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] rounded transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Category *</label>
                <input 
                  type="text" 
                  list="categoriesList"
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  placeholder="e.g. Documentation"
                />
                <datalist id="categoriesList">
                  {categories.filter(Boolean).map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Link Name *</label>
                <input 
                  type="text" 
                  required
                  value={formData.link_name}
                  onChange={e => setFormData({ ...formData, link_name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  placeholder="e.g. Setup Guide"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">URL *</label>
                <input 
                  type="url" 
                  required
                  value={formData.link_url}
                  onChange={e => setFormData({ ...formData, link_url: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] min-h-[80px]"
                  placeholder="Brief description of this link"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Note</label>
                <textarea 
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] min-h-[60px]"
                  placeholder="Any additional notes"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-primary)] flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveLink}
                disabled={isSaving}
                className="btn-primary px-4 py-2 rounded font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default DataListLinkView;
