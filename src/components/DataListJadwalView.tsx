import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { DataListJadwal } from '../types';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Plus, Trash2, Edit2, ExternalLink, ChevronUp, ChevronDown, ListIcon, X, ChevronLeft, ChevronRight, Filter, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export interface DataListJadwalViewRef {
  openAddModal: (defaultDate?: string) => void;
}

interface DataListJadwalViewProps {
  dataJadwal: DataListJadwal[];
  searchQuery: string;
  onClearSearch?: () => void;
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

const DataListJadwalView = forwardRef<DataListJadwalViewRef, DataListJadwalViewProps>(({ dataJadwal, searchQuery, onClearSearch, metadataOptions }, ref) => {
  
  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedWHPartners, setSelectedWHPartners] = useState<string[]>([]);

  // Sort
  const [sortField, setSortField] = useState<keyof DataListJadwal>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Date Filter
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // View Mode
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, field: 'status_btb_wh' | 'status_btb_brand', value: string) => {
    setUpdatingStatusId(`${id}-${field}`);
    try {
      await updateDoc(doc(db, 'data_list_jadwal', id), { [field]: value });
      toast.success('Status updated successfully');
    } catch (error: any) {
      toast.error('Failed to update status: ' + error.message);
    } finally {
      setUpdatingStatusId(null);
    }
  };

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

  const uniqueTypes = useMemo(() => Array.from(new Set([...metadataOptions.type_jadwal, ...dataJadwal.map(j => j.type).filter(Boolean)])).sort(), [metadataOptions.type_jadwal, dataJadwal]);
  const uniqueCategories = useMemo(() => Array.from(new Set([...metadataOptions.category_jadwal, ...dataJadwal.map(j => j.category).filter(Boolean)])).sort(), [metadataOptions.category_jadwal, dataJadwal]);
  const uniqueWHCodes = useMemo(() => Array.from(new Set([...metadataOptions.wh_code_jadwal, ...dataJadwal.map(j => j.wh_code).filter(Boolean)])).sort(), [metadataOptions.wh_code_jadwal, dataJadwal]);
  const uniqueWHNames = useMemo(() => Array.from(new Set([...metadataOptions.wh_name_jadwal, ...dataJadwal.map(j => j.wh_name).filter(Boolean)])).sort(), [metadataOptions.wh_name_jadwal, dataJadwal]);
  const uniqueWHPartners = useMemo(() => Array.from(new Set([...metadataOptions.wh_partner_jadwal, ...dataJadwal.map(j => j.wh_partner).filter(Boolean)])).sort(), [metadataOptions.wh_partner_jadwal, dataJadwal]);

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

    if (dateFilter !== 'all') {
      const now = new Date();
      let start = new Date(0);
      let end = new Date();
      end.setHours(23, 59, 59, 999);

      if (dateFilter === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateFilter === 'last7') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
      } else if (dateFilter === 'thisMonth') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (dateFilter === 'lastMonth') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'thisYear') {
        start = new Date(now.getFullYear(), 0, 1);
      } else if (dateFilter === 'lastYear') {
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        end.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'semester1') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 5, 30);
        end.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'semester2') {
        start = new Date(now.getFullYear(), 6, 1);
        end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'custom') {
        if (startDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
        }
        if (endDate) {
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
        }
      }

      filtered = filtered.filter(j => {
        if (!j.date) return false;
        const taskDate = new Date(j.date);
        return taskDate >= start && taskDate <= end;
      });
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
  }, [dataJadwal, searchQuery, selectedTypes, selectedCategories, selectedWHPartners, sortField, sortOrder, dateFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredJadwal.length / rowsPerPage));
  const paginatedJadwal = filteredJadwal.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const openAddModal = (defaultDate?: string) => {
    setEditingJadwal(null);
    setFormData({
      date: defaultDate || new Date().toISOString().split('T')[0],
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
    const codePrefix = `J-`;
    const currentEditingJadwal = editingJadwal;
    closeModal(); // Close immediately for better UX
    
    try {
      const dbRef = collection(db, 'data_list_jadwal');
      
      const saveData = {
        ...formData,
        updated_at: serverTimestamp(),
      };

      if (currentEditingJadwal) {
        await updateDoc(doc(db, 'data_list_jadwal', currentEditingJadwal.id), saveData);
        toast.success('Jadwal updated successfully');
      } else {
        const codePrefix = `J-`;
        let maxSeq = 0;
        dataJadwal.forEach(j => {
          if (j.display_id && j.display_id.match(/^J-\d{4,}$/)) {
            const match = j.display_id.substring(codePrefix.length);
            const num = parseInt(match, 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        });
        
        let newDisplayId = `${codePrefix}${String(maxSeq + 1).padStart(4, '0')}`;

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
    const currentId = editingJadwal.id;
    closeModal(); // UX immediate close
    
    try {
      await deleteDoc(doc(db, 'data_list_jadwal', currentId));
      toast.success('Jadwal deleted successfully');
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

  const legacyJadwalCount = dataJadwal.filter(j => j.display_id && j.display_id.match(/^J-\d{4}-\d+$/)).length;

  const fixLegacyIds = async () => {
    if (!confirm('This will update all old format J-YYMM-XXXX IDs to J-XXXX. Continue?')) return;
    
    // sort by existing display_id to preserve the sequence flow chronologically
    const sorted = [...dataJadwal].sort((a, b) => {
      return (a.display_id || '').localeCompare(b.display_id || '');
    });
    
    let seq = 1;
    let updated = 0;
    try {
      for (const j of sorted) {
        const newId = `J-${String(seq).padStart(4, '0')}`;
        if (j.display_id !== newId) {
          await updateDoc(doc(db, 'data_list_jadwal', j.id), { display_id: newId });
          updated++;
        }
        seq++;
      }
      toast.success(`Successfully updated ${updated} Jadwal IDs`);
    } catch (e: any) {
      toast.error('Error updating IDs: ' + e.message);
    }
  };

  const renderCalendarView = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const jadwalByDate = filteredJadwal.reduce((acc, j) => {
      if (j.date) {
        if (!acc[j.date]) acc[j.date] = [];
        acc[j.date].push(j);
      }
      return acc;
    }, {} as Record<string, typeof filteredJadwal>);

    return (
      <div className="flex-1 flex flex-col h-full bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            {monthNames[month]} {year}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} className="p-1 hover:bg-[var(--bg-secondary)] rounded transition-colors border border-[var(--border-color)]">
              <ChevronLeft className="w-4 h-4 text-[var(--text-primary)]" />
            </button>
            <button onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="text-xs font-medium px-2 py-1 border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] rounded transition-colors text-[var(--text-primary)]">
              Today
            </button>
            <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} className="p-1 hover:bg-[var(--bg-secondary)] rounded transition-colors border border-[var(--border-color)]">
              <ChevronRight className="w-4 h-4 text-[var(--text-primary)]" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--bg-body)] custom-scrollbar border-t-0">
          <div className="sticky top-0 z-10 grid grid-cols-7 gap-px bg-[var(--border-color)] border-b border-[var(--border-color)] shadow-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 text-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-secondary)]">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 auto-rows-[minmax(120px,1fr)] gap-px bg-[var(--border-color)]">
            {days.map((dateObj, i) => {
              if (!dateObj) {
                return <div key={`empty-${i}`} className="min-h-[120px] bg-[var(--bg-body)] opacity-50" />;
              }
              
              const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
              const todaysJadwal = jadwalByDate[dateStr] || [];
              const isToday = new Date().toDateString() === dateObj.toDateString();

              return (
                <div key={dateStr} className="min-h-[120px] p-1.5 flex flex-col gap-1 transition-colors hover:bg-[var(--bg-secondary-hover)] relative group bg-[var(--bg-surface)]">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[var(--accent-color)] text-[var(--text-on-accent)]' : 'text-[var(--text-primary)]'}`}>
                      {dateObj.getDate()}
                    </span>
                    <button 
                      onClick={() => openAddModal(dateStr)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--bg-primary)] rounded transition-all text-[var(--text-secondary)] hover:text-[var(--accent-color)]"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                    {todaysJadwal.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => openEditModal(item)}
                        className="text-[10px] border border-[var(--border-color)] bg-[var(--bg-primary)] rounded p-1 cursor-pointer hover:border-[var(--accent-color)] hover:shadow-sm transition-all flex flex-col gap-0.5"
                        title={`Category: ${item.category}\nWH Code: ${item.wh_code}\nWH Name: ${item.wh_name}\nWH Partner: ${item.wh_partner}`}
                      >
                        <div className="font-bold text-[var(--text-primary)] truncate">{item.display_id || item.wh_code}</div>
                        <div className="text-[var(--text-secondary)] truncate">{item.type}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[8px] px-1 py-0.5 rounded leading-none ${getStatusBadgeClass(item.status_btb_wh)}`}>{item.status_btb_wh === 'None' ? 'W:N' : `W:${item.status_btb_wh[0]}`}</span>
                          <span className={`text-[8px] px-1 py-0.5 rounded leading-none ${getStatusBadgeClass(item.status_btb_brand)}`}>{item.status_btb_brand === 'None' ? 'B:N' : `B:${item.status_btb_brand[0]}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-[var(--bg-body)] h-full overflow-hidden">
      <div className="mb-4 flex items-center justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Dropdown */}
          <div className="relative group/main z-20">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-primary)] transition-colors">
              <Filter className="w-3.5 h-3.5" />
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </button>
          
          <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/main:opacity-100 group-hover/main:visible transition-all z-40 py-2">
            
            {/* Type Submenu */}
            {uniqueTypes.length > 0 && (
              <div className="relative group/type px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                <span className="font-medium">Type {selectedTypes.length > 0 && `(${selectedTypes.length})`}</span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/type:text-[var(--text-primary)]" />
                
                <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/type:opacity-100 group-hover/type:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                  <div className="space-y-1">
                    {uniqueTypes.map(t => (
                      <label key={`ft-${t}`} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedTypes.includes(t)}
                          onChange={() => toggleArrayItem(setSelectedTypes, t)} 
                          className="rounded border-gray-300 dark:border-gray-600 bg-[var(--bg-primary)] h-3.5 w-3.5" 
                        />
                        <span className="text-sm text-[var(--text-primary)]">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Category Submenu */}
            {uniqueCategories.length > 0 && (
              <div className="relative group/category px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                <span className="font-medium">Category {selectedCategories.length > 0 && `(${selectedCategories.length})`}</span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/category:text-[var(--text-primary)]" />
                
                <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/category:opacity-100 group-hover/category:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                  <div className="space-y-1">
                    {uniqueCategories.map(c => (
                      <label key={`fc-${c}`} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedCategories.includes(c)}
                          onChange={() => toggleArrayItem(setSelectedCategories, c)} 
                          className="rounded border-gray-300 dark:border-gray-600 bg-[var(--bg-primary)] h-3.5 w-3.5" 
                        />
                        <span className="text-sm text-[var(--text-primary)]">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* WH Partner Submenu */}
            {uniqueWHPartners.length > 0 && (
              <div className="relative group/whpartner px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                <span className="font-medium">WH Partner {selectedWHPartners.length > 0 && `(${selectedWHPartners.length})`}</span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/whpartner:text-[var(--text-primary)]" />
                
                <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/whpartner:opacity-100 group-hover/whpartner:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                  <div className="space-y-1">
                    {uniqueWHPartners.map(wp => (
                      <label key={`fw-${wp}`} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedWHPartners.includes(wp)}
                          onChange={() => toggleArrayItem(setSelectedWHPartners, wp)} 
                          className="rounded border-gray-300 dark:border-gray-600 bg-[var(--bg-primary)] h-3.5 w-3.5" 
                        />
                        <span className="text-sm text-[var(--text-primary)]">{wp}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2 bg-[var(--bg-secondary)] p-1 rounded-md border border-[var(--border-color)]">
            <Calendar className="w-4 h-4 text-[var(--text-secondary)] ml-2" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none text-sm text-[var(--text-primary)] focus:ring-0 cursor-pointer py-1 pr-8 outline-none"
            >
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="all">All Time</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="today">Today</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="last7">Last 7 Days</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="thisMonth">This Month</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="lastMonth">Last Month</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="thisYear">This Year</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="lastYear">Last Year</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="semester1">Semester 1 (Jan-Jun)</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="semester2">Semester 2 (Jul-Dec)</option>
              <option className="bg-[var(--bg-body)] text-[var(--text-primary)]" value="custom">Custom Range</option>
            </select>
          </div>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-sm px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
              <span className="text-[var(--text-secondary)]">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-sm px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          )}

          {(activeFiltersCount > 0 || dateFilter !== 'all' || searchQuery.length > 0) && (
            <button 
              onClick={() => {
                setSelectedTypes([]);
                setSelectedCategories([]);
                setSelectedWHPartners([]);
                setDateFilter('all');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
                onClearSearch?.();
              }}
              className="px-3 py-1.5 text-xs text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 rounded-md transition-colors font-medium"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {legacyJadwalCount > 0 && (
            <button 
              onClick={fixLegacyIds}
              className="px-3 py-1.5 text-xs border border-orange-500/30 text-orange-600 bg-orange-500/10 rounded-md hover:bg-orange-500/20 transition-colors font-medium flex items-center gap-1.5"
            >
              Migrate {legacyJadwalCount} Legacy IDs
            </button>
          )}

          {/* View Toggle */}
          <div className="flex items-center bg-[var(--bg-secondary)] p-1 rounded-md border border-[var(--border-color)]">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              title="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">List</span>
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              title="Calendar View"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Calendar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-sm flex flex-col overflow-hidden">
        {viewMode === 'list' ? (
          <>
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
                    <td className="px-4 py-3 text-sm truncate" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block w-full max-w-[120px]">
                        <select 
                          value={jadwal.status_btb_wh}
                          onChange={(e) => handleStatusChange(jadwal.id, 'status_btb_wh', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={updatingStatusId === `${jadwal.id}-status_btb_wh`}
                          className={`w-full appearance-none px-2 py-0.5 rounded text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all ${getStatusBadgeClass(jadwal.status_btb_wh)} ${updatingStatusId === `${jadwal.id}-status_btb_wh` ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <option value="None" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">None</option>
                          <option value="Open" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Open</option>
                          <option value="In Progress" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">In Progress</option>
                          <option value="Done" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Done</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm truncate" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block w-full max-w-[120px]">
                        <select 
                          value={jadwal.status_btb_brand}
                          onChange={(e) => handleStatusChange(jadwal.id, 'status_btb_brand', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={updatingStatusId === `${jadwal.id}-status_btb_brand`}
                          className={`w-full appearance-none px-2 py-0.5 rounded text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all ${getStatusBadgeClass(jadwal.status_btb_brand)} ${updatingStatusId === `${jadwal.id}-status_btb_brand` ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <option value="None" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">None</option>
                          <option value="Open" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Open</option>
                          <option value="In Progress" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">In Progress</option>
                          <option value="Done" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Done</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>
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
        </>
        ) : (
          renderCalendarView()
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-[var(--text-primary)]" onClick={() => !isSaving && !isDeleting && setIsModalOpen(false)}>
          <div 
            className="bg-[var(--bg-surface)] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-[var(--border-color)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-primary)]">
              <h2 className="text-lg font-bold">{editingJadwal ? 'Edit Jadwal' : 'Add New Jadwal'} {editingJadwal && <span className="text-sm font-normal text-[var(--text-muted)] ml-2">{editingJadwal.display_id}</span>}</h2>
              <div className="flex items-center gap-2">
                {editingJadwal && (
                  <>
                    {!showDeleteConfirm ? (
                       <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete Jadwal"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-sm font-medium text-red-500">Delete jadwal?</span>
                        <button 
                          onClick={handleDelete}
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
                <button onClick={() => !isSaving && !isDeleting && closeModal()} className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] rounded transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                    {uniqueTypes.map(t => <option key={t} value={t} />)}
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
                    {uniqueCategories.map(c => <option key={c} value={c} />)}
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
                    {uniqueWHCodes.map(c => <option key={c} value={c} />)}
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
                    {uniqueWHNames.map(n => <option key={n} value={n} />)}
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
                    {uniqueWHPartners.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>

                <div className="md:col-span-2 border-t border-[var(--border-color)] my-2 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-sm font-bold text-[var(--text-primary)]">Status BtB WHP</div>
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
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Subject Email WHP</label>
                      <input 
                        type="text"
                        value={formData.subject_email}
                        onChange={(e) => setFormData({...formData, subject_email: e.target.value})}
                        placeholder="General Email Subject..."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                      />
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
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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
