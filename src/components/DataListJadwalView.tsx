import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { DataListJadwal } from '../types';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Plus, Trash2, Edit2, ExternalLink, ChevronUp, ChevronDown, ListIcon, X, ChevronLeft, ChevronRight, Filter, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export interface DataListJadwalViewRef {
  openAddModal: () => void;
}

interface DataListJadwalViewProps {
  dataJadwal: DataListJadwal[];
  searchQuery: string;
  metadataOptions: {
    type_jadwal: string[];
    category_jadwal: string[];
    wh_code_jadwal: string[];
    wh_name_jadwal: string[];
    wh_partner_jadwal: string[];
  };
}

const getPageNumbers = (current: number, total: number) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'Open': return 'badge-accent';
    case 'In Progress': return 'badge-warning';
    case 'Done': return 'badge-success';
    case 'None': return 'badge-neutral';
    default: return 'badge-neutral';
  }
};

const DataListJadwalView = forwardRef<DataListJadwalViewRef, DataListJadwalViewProps>(({ dataJadwal, searchQuery, metadataOptions }, ref) => {
  
  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedWHPartners, setSelectedWHPartners] = useState<string[]>([]);

  // Sort
  const [sortField, setSortField] = useState<keyof DataListJadwal>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Resizing
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>({
    display_id: 100,
    date: 120,
    type: 120,
    category: 150,
    wh_code: 120,
    wh_name: 200,
    status_btb_wh: 140,
    status_btb_brand: 140
  });
  const [resizingCol, setResizingCol] = useState<{ key: string, startX: number, startWidth: number } | null>(null);
  const isResizingRef = React.useRef(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<DataListJadwal | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: '',
    category: '',
    wh_code: '',
    wh_name: '',
    wh_partner: '',
    remark: '',
    subject_email: '',
    status_btb_wh: 'None' as 'None' | 'Open' | 'In Progress' | 'Done',
    subject_email_btb_brand: '',
    status_btb_brand: 'None' as 'None' | 'Open' | 'In Progress' | 'Done',
  });
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handlers for resizing
  const handleResizeStart = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setResizingCol({ key, startX: e.clientX, startWidth: colWidths[key] });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCol) return;
      isResizingRef.current = true;
      const diff = e.clientX - resizingCol.startX;
      const newWidth = Math.max(50, resizingCol.startWidth + diff);
      setColWidths(prev => ({ ...prev, [resizingCol.key]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
      setTimeout(() => {
        isResizingRef.current = false;
      }, 50);
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

  const onSort = (field: keyof DataListJadwal) => {
    if (isResizingRef.current) return;
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: keyof DataListJadwal }) => {
    if (sortField !== field) return <div className="w-3" />;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-[var(--accent-color)]" /> : <ChevronDown className="w-3 h-3 text-[var(--accent-color)]" />;
  };

  const filteredJadwal = useMemo(() => {
    let filtered = dataJadwal;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(j => 
        (j.display_id || '').toLowerCase().includes(q) ||
        (j.wh_code || '').toLowerCase().includes(q) ||
        (j.wh_name || '').toLowerCase().includes(q) ||
        (j.wh_partner || '').toLowerCase().includes(q) ||
        (j.subject_email || '').toLowerCase().includes(q) ||
        (j.subject_email_btb_brand || '').toLowerCase().includes(q) ||
        (j.remark || '').toLowerCase().includes(q)
      );
    }

    if (selectedTypes.length > 0) {
      filtered = filtered.filter(j => selectedTypes.includes(j.type));
    }
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(j => selectedCategories.includes(j.category));
    }
    if (selectedWHPartners.length > 0) {
      filtered = filtered.filter(j => selectedWHPartners.includes(j.wh_partner));
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
    });

    return filtered;
  }, [dataJadwal, searchQuery, selectedTypes, selectedCategories, selectedWHPartners, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredJadwal.length / rowsPerPage));
  const paginatedJadwal = filteredJadwal.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const openAddModal = () => {
    setEditingJadwal(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: '',
      category: '',
      wh_code: '',
      wh_name: '',
      wh_partner: '',
      remark: '',
      subject_email: '',
      status_btb_wh: 'None',
      subject_email_btb_brand: '',
      status_btb_brand: 'None'
    });
    setShowDeleteConfirm(false);
    setIsModalOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openAddModal
  }));

  const openEditModal = (jadwal: DataListJadwal) => {
    setEditingJadwal(jadwal);
    setFormData({
      date: jadwal.date || new Date().toISOString().split('T')[0],
      type: jadwal.type || '',
      category: jadwal.category || '',
      wh_code: jadwal.wh_code || '',
      wh_name: jadwal.wh_name || '',
      wh_partner: jadwal.wh_partner || '',
      remark: jadwal.remark || '',
      subject_email: jadwal.subject_email || '',
      status_btb_wh: jadwal.status_btb_wh || 'None',
      subject_email_btb_brand: jadwal.subject_email_btb_brand || '',
      status_btb_brand: jadwal.status_btb_brand || 'None',
    });
    setShowDeleteConfirm(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingJadwal(null);
  };

  const handleSave = async () => {
    if (!formData.date || !formData.type || !formData.category || !formData.wh_code) {
      toast.error('Date, Type, Category, and WH Code are required');
      return;
    }

    setIsSaving(true);
    try {
      const dbRef = collection(db, 'data_list_jadwal');
      
      const saveData = {
        ...formData,
        updated_at: serverTimestamp(),
      };

      if (editingJadwal) {
        await updateDoc(doc(db, 'data_list_jadwal', editingJadwal.id), saveData);
        toast.success('Jadwal updated successfully');
      } else {
        let newDisplayId = '';
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const codePrefix = `J-${year}${month}-`;
        
        // Find highest sequence for this month
        const thisMonthJadwal = dataJadwal.filter(j => j.display_id?.startsWith(codePrefix));
        let maxSeq = 0;
        thisMonthJadwal.forEach(j => {
          const match = j.display_id?.match(/-(\d+)$/);
          if (match && parseInt(match[1]) > maxSeq) {
            maxSeq = parseInt(match[1]);
          }
        });
        
        newDisplayId = `${codePrefix}${String(maxSeq + 1).padStart(4, '0')}`;

        await addDoc(dbRef, {
          ...saveData,
          display_id: newDisplayId,
          created_at: serverTimestamp()
        });
        toast.success('Jadwal created successfully');
      }

      // Add to metadata options if new
      const updates: any = {};
      
      if (formData.type && !metadataOptions.type_jadwal.includes(formData.type)) {
        updates.type_jadwal = arrayUnion(formData.type);
      }
      if (formData.category && !metadataOptions.category_jadwal.includes(formData.category)) {
        updates.category_jadwal = arrayUnion(formData.category);
      }
      if (formData.wh_code && !metadataOptions.wh_code_jadwal.includes(formData.wh_code)) {
        updates.wh_code_jadwal = arrayUnion(formData.wh_code);
      }
      if (formData.wh_name && !metadataOptions.wh_name_jadwal.includes(formData.wh_name)) {
        updates.wh_name_jadwal = arrayUnion(formData.wh_name);
      }
      if (formData.wh_partner && !metadataOptions.wh_partner_jadwal.includes(formData.wh_partner)) {
        updates.wh_partner_jadwal = arrayUnion(formData.wh_partner);
      }

      if (Object.keys(updates).length > 0) {
        try {
          await setDoc(doc(db, 'metadata', 'dropdowns'), updates, { merge: true });
        } catch (e) {
          console.error("Failed to update dropdowns", e);
        }
      }

      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save jadwal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingJadwal) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'data_list_jadwal', editingJadwal.id));
      toast.success('Jadwal deleted successfully');
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete jadwal');
    } finally {
      setIsDeleting(false);
    }
  };

  const onRowsPerPageChange = (val: number) => {
    setRowsPerPage(val);
    setCurrentPage(1);
  };

  const onPageChange = (page: number) => {
    setCurrentPage(page);
  };

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setter(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    setCurrentPage(1);
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch(e) {
       return dateString;
    }
  }

  // Autofill logic
  const handleWHCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Attempt to autofill WH Name & Partner
    const existing = dataJadwal.find(j => j.wh_code === val);
    setFormData(prev => ({
       ...prev,
       wh_code: val,
       wh_name: existing?.wh_name ? existing.wh_name : prev.wh_name,
       wh_partner: existing?.wh_partner ? existing.wh_partner : prev.wh_partner
    }));
  }

  const activeFiltersCount = selectedTypes.length + selectedCategories.length + selectedWHPartners.length;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-[var(--bg-body)] h-full overflow-hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
        
        {/* Filter Dropdown */}
        <div className="relative group/main z-20">
          <button className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1 bg-[var(--accent-color)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)] ml-1" />
          </button>
          
          <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-lg opacity-0 invisible group-hover/main:opacity-100 group-hover/main:visible transition-all pointer-events-none group-hover/main:pointer-events-auto divide-y divide-[var(--border-color)]">
            
            {/* Type Filter */}
            <div className="p-2">
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">Type</div>
              {metadataOptions.type_jadwal.map(t => (
                <label key={`ft-${t}`} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-secondary)] rounded cursor-pointer">
                  <input type="checkbox" checked={selectedTypes.includes(t)} onChange={() => toggleArrayItem(setSelectedTypes, t)} className="rounded border-gray-300 dark:border-gray-600 bg-[var(--bg-primary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{t}</span>
                </label>
              ))}
            </div>

            {/* Category Filter */}
            <div className="p-2">
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">Category</div>
              {metadataOptions.category_jadwal.map(c => (
                <label key={`fc-${c}`} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-secondary)] rounded cursor-pointer">
                  <input type="checkbox" checked={selectedCategories.includes(c)} onChange={() => toggleArrayItem(setSelectedCategories, c)} className="rounded border-gray-300 dark:border-gray-600 bg-[var(--bg-primary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{c}</span>
                </label>
              ))}
            </div>

            {/* WH Partner Filter */}
            <div className="p-2">
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">WH Partner</div>
              {metadataOptions.wh_partner_jadwal.map(wp => (
                <label key={`fw-${wp}`} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-secondary)] rounded cursor-pointer">
                  <input type="checkbox" checked={selectedWHPartners.includes(wp)} onChange={() => toggleArrayItem(setSelectedWHPartners, wp)} className="rounded border-gray-300 dark:border-gray-600 bg-[var(--bg-primary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{wp}</span>
                </label>
              ))}
            </div>

            {activeFiltersCount > 0 && (
              <div className="p-2">
                <button 
                  onClick={() => {
                    setSelectedTypes([]);
                    setSelectedCategories([]);
                    setSelectedWHPartners([]);
                    setCurrentPage(1);
                  }}
                  className="w-full py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto overflow-x-auto min-w-0 pb-10">
          <table className="w-full text-left border-collapse table-fixed select-none">
            <thead className="bg-[var(--bg-surface)] sticky top-0 z-10 shadow-[0_1px_0_var(--border-color)]">
              <tr>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('display_id')}
                  style={{ width: colWidths.display_id }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    ID <SortIcon field="display_id" />
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'display_id')} onClick={(e) => e.stopPropagation()} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('date')}
                  style={{ width: colWidths.date }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Date <SortIcon field="date" />
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'date')} onClick={(e) => e.stopPropagation()} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('type')}
                  style={{ width: colWidths.type }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Type <SortIcon field="type" />
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'type')} onClick={(e) => e.stopPropagation()} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('category')}
                  style={{ width: colWidths.category }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Category <SortIcon field="category" />
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'category')} onClick={(e) => e.stopPropagation()} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('wh_code')}
                  style={{ width: colWidths.wh_code }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    WH Code <SortIcon field="wh_code" />
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'wh_code')} onClick={(e) => e.stopPropagation()} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('wh_name')}
                  style={{ width: colWidths.wh_name }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    WH Name <SortIcon field="wh_name" />
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'wh_name')} onClick={(e) => e.stopPropagation()} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('status_btb_wh')}
                  style={{ width: colWidths.status_btb_wh }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Status BtB WH <SortIcon field="status_btb_wh" />
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'status_btb_wh')} onClick={(e) => e.stopPropagation()} />
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                  onClick={() => onSort('status_btb_brand')}
                  style={{ width: colWidths.status_btb_brand }}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    Status BtB Brand <SortIcon field="status_btb_brand" />
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'status_btb_brand')} onClick={(e) => e.stopPropagation()} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {paginatedJadwal.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    No jadwal found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedJadwal.map((jadwal) => (
                  <tr 
                    key={jadwal.id} 
                    className="hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors group"
                    onClick={() => openEditModal(jadwal)}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-[var(--text-muted)] truncate">{jadwal.display_id}</td>
                    <td className="px-4 py-3 text-sm truncate text-[var(--text-primary)]">{formatDate(jadwal.date)}</td>
                    <td className="px-4 py-3 text-sm truncate text-[var(--text-secondary)]">{jadwal.type}</td>
                    <td className="px-4 py-3 text-sm truncate text-[var(--text-secondary)]">{jadwal.category}</td>
                    <td className="px-4 py-3 text-sm truncate text-[var(--text-primary)] font-medium">{jadwal.wh_code}</td>
                    <td className="px-4 py-3 text-sm truncate text-[var(--text-secondary)]" title={jadwal.wh_name}>{jadwal.wh_name}</td>
                    <td className="px-4 py-3 text-sm truncate">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(jadwal.status_btb_wh)}`}>
                        {jadwal.status_btb_wh}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm truncate">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(jadwal.status_btb_brand)}`}>
                        {jadwal.status_btb_brand}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredJadwal.length > 0 && (
          <div className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Show</span>
                <select 
                  value={rowsPerPage}
                  onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                  className="text-xs border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                >
                  {[10, 20, 50, 100].map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
                <span className="text-xs text-[var(--text-muted)]">per page</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="p-1 rounded hover:bg-[var(--bg-primary)] disabled:opacity-30 transition-colors text-[var(--text-secondary)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {getPageNumbers(currentPage, totalPages).map((page, index) => (
                  <button
                    key={`${page}-${index}`}
                    disabled={page === '...'}
                    onClick={() => page !== '...' && onPageChange(Number(page))}
                    className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded transition-all ${currentPage === page ? 'bg-[var(--accent-color)] text-[var(--text-on-accent)]' : page === '...' ? 'text-[var(--text-muted)] cursor-default' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary-hover)] cursor-pointer'}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="p-1 rounded hover:bg-[var(--bg-primary)] disabled:opacity-30 transition-colors text-[var(--text-secondary)]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-start pt-10 overflow-y-auto">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col mb-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
              <h2 className="text-lg font-bold">{editingJadwal ? 'Edit Jadwal' : 'Add New Jadwal'} {editingJadwal && <span className="text-sm font-normal text-[var(--text-muted)] ml-2">{editingJadwal.display_id}</span>}</h2>
              <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Date *</label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Type *</label>
                  <input 
                    type="text"
                    list="type_jadwal_list"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    placeholder="Enter or select type"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                  />
                  <datalist id="type_jadwal_list">
                    {metadataOptions.type_jadwal.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Category *</label>
                  <input 
                    type="text"
                    list="category_jadwal_list"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="Enter or select category"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                  />
                  <datalist id="category_jadwal_list">
                    {metadataOptions.category_jadwal.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">WH Code *</label>
                  <input 
                    type="text"
                    list="wh_code_jadwal_list"
                    value={formData.wh_code}
                    onChange={handleWHCodeChange}
                    placeholder="Enter WH Code"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all uppercase"
                  />
                  <datalist id="wh_code_jadwal_list">
                    {metadataOptions.wh_code_jadwal.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">WH Name</label>
                  <input 
                    type="text"
                    list="wh_name_jadwal_list"
                    value={formData.wh_name}
                    onChange={(e) => setFormData({...formData, wh_name: e.target.value})}
                    placeholder="Enter WH Name"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                  />
                  <datalist id="wh_name_jadwal_list">
                    {metadataOptions.wh_name_jadwal.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">WH Partner</label>
                  <input 
                    type="text"
                    list="wh_partner_jadwal_list"
                    value={formData.wh_partner}
                    onChange={(e) => setFormData({...formData, wh_partner: e.target.value})}
                    placeholder="Enter WH Partner"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                  />
                  <datalist id="wh_partner_jadwal_list">
                    {metadataOptions.wh_partner_jadwal.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>

                <div className="md:col-span-2 border-t border-[var(--border-color)] my-2 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-sm font-bold text-[var(--text-primary)]">Status BtB WH</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Status</label>
                      <select 
                        value={formData.status_btb_wh}
                        onChange={(e) => setFormData({...formData, status_btb_wh: e.target.value as any})}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                      >
                        <option value="None">None</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 border-t border-[var(--border-color)] my-2 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-sm font-bold text-[var(--text-primary)]">Status BtB Brand</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Status</label>
                      <select 
                        value={formData.status_btb_brand}
                        onChange={(e) => setFormData({...formData, status_btb_brand: e.target.value as any})}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                      >
                        <option value="None">None</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Subject Email</label>
                      <input 
                        type="text"
                        value={formData.subject_email_btb_brand}
                        onChange={(e) => setFormData({...formData, subject_email_btb_brand: e.target.value})}
                        placeholder="Subject Email Brand..."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 border-t border-[var(--border-color)] my-2 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Subject Email (Optional)</label>
                      <input 
                        type="text"
                        value={formData.subject_email}
                        onChange={(e) => setFormData({...formData, subject_email: e.target.value})}
                        placeholder="General Email Subject..."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Remark</label>
                      <textarea 
                        value={formData.remark}
                        onChange={(e) => setFormData({...formData, remark: e.target.value})}
                        placeholder="Notes..."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all resize-y min-h-[60px]"
                      />
                    </div>
                  </div>
                </div>

              </div>
              
              {editingJadwal && (
                <div className="mt-8 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Danger Zone</h4>
                    <p className="text-xs text-red-500 dark:text-red-300 mt-1">Once you delete this item, there is no going back. Please be certain.</p>
                  </div>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-sm border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">Cancel</button>
                      <button onClick={handleDelete} disabled={isDeleting} className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50">
                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 text-sm border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" /> Delete Jadwal
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end gap-2 shrink-0 rounded-b-lg">
              <button 
                onClick={closeModal}
                className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded hover:bg-[var(--bg-primary)] transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary"
              >
                {isSaving ? 'Saving...' : 'Save Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default DataListJadwalView;
