import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { DataListKlaim, Attachment, ActivityLog } from '../types';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Search, Plus, Trash2, Edit2, ExternalLink, ChevronUp, ChevronDown, ListIcon, X, ChevronLeft, ChevronRight, Filter, Upload, Loader2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../apiInterceptor';

export interface DataListKlaimViewRef {
  openAddModal: () => void;
}

interface DataListKlaimViewProps {
  dataKlaim: DataListKlaim[];
  searchQuery: string;
  onClearSearch?: () => void;
  metadataOptions: {
    claim_type: string[];
    wh_name_klaim: string[];
    partner_klaim: string[];
    subsidiary: string[];
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
    case 'Pending Finance': return 'badge-info';
    case 'Done': return 'badge-success';
    default: return 'badge-neutral';
  }
};

const DataListKlaimView = forwardRef<DataListKlaimViewRef, DataListKlaimViewProps>(({ dataKlaim, searchQuery, onClearSearch, metadataOptions }, ref) => {
  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedWHP, setSelectedWHP] = useState<string[]>([]);

  // Sort
  const [sortField, setSortField] = useState<keyof DataListKlaim>('display_id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  // Date Filter
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setter(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    setCurrentPage(1);
  };
  
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const logActivity = async (klaimId: string, action: string, details: string) => {
    const user = auth.currentUser;
    const userName = user?.displayName || user?.email || 'Unknown User';
    try {
      await addDoc(collection(db, 'activity_log'), {
        task_id: klaimId,
        user: userName,
        action,
        details,
        created_at: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to log activity", e);
    }
  };

  const handleStatusChange = async (id: string, value: string, oldStatus?: string) => {
    setUpdatingStatusId(id);
    try {
      await updateDoc(doc(db, 'data_list_klaim', id), { status: value });
      await logActivity(id, "Updated Klaim", `Status changed from '${oldStatus || 'None'}' to '${value}'`);
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
    claim_type: 140,
    whp_name: 180,
    invoice_date: 120,
    invoice_no: 140,
    description: 250,
    claim_value: 120,
    due: 120,
    status: 140
  });
  const [resizingCol, setResizingCol] = useState<{ key: string, startX: number, startWidth: number } | null>(null);
  const isResizingRef = React.useRef(false);

  const uniqueClaimTypes = useMemo(() => Array.from(new Set([...metadataOptions.claim_type, ...dataKlaim.map(j => j.claim_type).filter(Boolean)])).sort(), [metadataOptions.claim_type, dataKlaim]);
  const uniqueWHPs = useMemo(() => Array.from(new Set([...metadataOptions.wh_name_klaim, ...dataKlaim.map(j => j.whp_name).filter(Boolean)])).sort(), [metadataOptions.wh_name_klaim, dataKlaim]);
  const uniquePartners = useMemo(() => Array.from(new Set([...metadataOptions.partner_klaim, ...dataKlaim.map(j => j.partner).filter(Boolean)])).sort(), [metadataOptions.partner_klaim, dataKlaim]);
  const uniqueSubsidiaries = useMemo(() => Array.from(new Set([...metadataOptions.subsidiary, ...dataKlaim.map(j => j.subsidiary).filter(Boolean)])).sort(), [metadataOptions.subsidiary, dataKlaim]);

  const [showFilters, setShowFilters] = useState(false);

  const filteredData = useMemo(() => {
    let filtered = [...dataKlaim];

    if (searchQuery.trim()) {
      const ms = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        (item.display_id || '').toLowerCase().includes(ms) ||
        (item.invoice_no || '').toLowerCase().includes(ms) ||
        (item.description || '').toLowerCase().includes(ms) ||
        (item.whp_name || '').toLowerCase().includes(ms)
      );
    }

    if (selectedTypes.length > 0) {
      filtered = filtered.filter(item => selectedTypes.includes(item.claim_type));
    }
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(item => selectedStatus.includes(item.status));
    }
    if (selectedWHP.length > 0) {
      filtered = filtered.filter(item => selectedWHP.includes(item.whp_name));
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
        if (!j.invoice_date) return false;
        const taskDate = new Date(j.invoice_date);
        return taskDate >= start && taskDate <= end;
      });
    }

    filtered.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
    });

    return filtered;
  }, [dataKlaim, searchQuery, selectedTypes, selectedStatus, selectedWHP, sortField, sortOrder, dateFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const currentData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  const handleSort = (field: keyof DataListKlaim) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!resizingCol) return;
    isResizingRef.current = true;
    const diff = e.clientX - resizingCol.startX;
    const newWidth = Math.max(50, resizingCol.startWidth + diff);
    setColWidths(prev => ({ ...prev, [resizingCol.key]: newWidth }));
  }, [resizingCol]);

  const handleMouseUp = React.useCallback(() => {
    setResizingCol(null);
    setTimeout(() => { isResizingRef.current = false; }, 0);
  }, []);

  React.useEffect(() => {
    if (resizingCol) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, handleMouseMove, handleMouseUp]);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DataListKlaim | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState<number | string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<DataListKlaim>>({
    claim_type: '',
    invoice_date: '',
    invoice_no: '',
    description: '',
    subject_email: '',
    link_data: '',
    whp_name: '',
    partner: '',
    claim_value: 0,
    tax: 0,
    subsidiary: '',
    status: 'Open',
    remark: ''
  });

  const fetchAttachments = async (id: string) => {
    try {
      const res = await apiFetch(`/api/klaim/${id}/attachments`);
      if (res.ok) {
        setAttachments(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch attachments", err);
    }
  };

  const fetchActivities = async (id: string) => {
    try {
      const res = await apiFetch(`/api/klaim/${id}/activities`);
      if (res.ok) {
        setActivities(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch activities", err);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);

    if (!editingItem) {
      setPendingFiles(prev => [...prev, ...newFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    let uploadedCount = 0;
    let latestFolderUrl: string | undefined = undefined;
    try {
      for (const file of newFiles) {
        const payloadData = new FormData();
        payloadData.append('file', file);
        if (formData.invoice_date) {
            payloadData.append('invoice_date', formData.invoice_date);
        }
        if (formData.whp_name) {
            payloadData.append('whp_name', formData.whp_name);
        }
        const res = await apiFetch(`/api/klaim/${editingItem.id}/attachments`, {
          method: 'POST',
          body: payloadData
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        if (data.folder_url) latestFolderUrl = data.folder_url;
        uploadedCount++;
      }
    } catch (err) {
      console.error("Upload error", err);
      toast.error('Failed to upload one or more files');
    } finally {
      if (uploadedCount > 0) {
        toast.success(`Successfully uploaded ${uploadedCount} file(s)`);
        fetchAttachments(editingItem.id);
        fetchActivities(editingItem.id);
        if (latestFolderUrl) {
          setFormData(prev => ({ ...prev, link_data: latestFolderUrl }));
        }
      }
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (id: string | number) => {
    setIsDeletingAttachment(id);
    try {
      const res = await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (res.ok && editingItem) {
        fetchAttachments(editingItem.id);
        fetchActivities(editingItem.id);
        toast.success("Attachment deleted");
      } else {
        toast.error("Failed to delete attachment");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while deleting attachment");
    } finally {
      setIsDeletingAttachment(null);
    }
  };

  useImperativeHandle(ref, () => ({
    openAddModal: () => {
      setEditingItem(null);
      setFormData({
        claim_type: '',
        invoice_date: '',
        invoice_no: '',
        description: '',
        subject_email: '',
        link_data: '',
        whp_name: '',
        partner: '',
        claim_value: 0,
        tax: 0,
        subsidiary: '',
        status: 'Open',
        remark: ''
      });
      setIsModalOpen(true);
    }
  }));

  const openEditModal = (item: DataListKlaim) => {
    setEditingItem(item);
    setFormData({
      claim_type: item.claim_type || '',
      invoice_date: item.invoice_date || '',
      invoice_no: item.invoice_no || '',
      description: item.description || '',
      subject_email: item.subject_email || '',
      link_data: item.link_data || '',
      whp_name: item.whp_name || '',
      partner: item.partner || '',
      claim_value: item.claim_value || 0,
      tax: item.tax || 0,
      subsidiary: item.subsidiary || '',
      status: item.status || 'Open',
      remark: item.remark || ''
    });
    setAttachments([]);
    setActivities([]);
    fetchAttachments(item.id);
    fetchActivities(item.id);
    setPendingFiles([]);
    setIsModalOpen(true);
  };

  const handleWHPChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newWhp = e.target.value;
    // Auto-fill partner if found in existing data
    const existing = dataKlaim.find(d => d.whp_name === newWhp && d.partner);
    setFormData(prev => ({
      ...prev,
      whp_name: newWhp,
      partner: existing ? existing.partner : prev.partner
    }));
  };

  const handleClaimValueTaxChange = (field: 'claim_value' | 'tax', valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setFormData(prev => {
      const newVal = { ...prev, [field]: val };
      return newVal;
    });
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      const targetItem = dataKlaim.find(d => d.id === id);
      await deleteDoc(doc(db, 'data_list_klaim', id));
      if (targetItem) {
        await logActivity(id, "Deleted Klaim", `Deleted Klaim ${targetItem.display_id || targetItem.invoice_no}`);
      }
      toast.success("Deleted successfully");
      setIsModalOpen(false);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const calculatedDue = (formData.claim_value || 0) + (formData.tax || 0);

      const finalData = {
        ...formData,
        due: calculatedDue,
        updated_at: serverTimestamp()
      };

      if (editingItem) {
        await updateDoc(doc(db, 'data_list_klaim', editingItem.id), finalData);
        // Find changes
        const changes: string[] = [];
        if (editingItem.claim_type !== formData.claim_type) changes.push(`Claim Type: ${editingItem.claim_type} -> ${formData.claim_type}`);
        if (editingItem.invoice_no !== formData.invoice_no) changes.push(`Invoice No: ${editingItem.invoice_no} -> ${formData.invoice_no}`);
        if (editingItem.invoice_date !== formData.invoice_date) changes.push(`Invoice Date: ${editingItem.invoice_date} -> ${formData.invoice_date}`);
        if (editingItem.claim_value !== formData.claim_value) changes.push(`Claim Value: ${editingItem.claim_value} -> ${formData.claim_value}`);
        if (editingItem.tax !== formData.tax) changes.push(`Tax: ${editingItem.tax} -> ${formData.tax}`);
        if (editingItem.status !== formData.status) changes.push(`Status: ${editingItem.status} -> ${formData.status}`);

        const detailsStr = changes.length > 0 ? changes.join('\n') : "Klaim details updated";
        await logActivity(editingItem.id, "Updated Klaim", detailsStr);
        
        toast.success("Klaim updated");
      } else {
        // Find existing KL count
        const klDocs = dataKlaim.filter(d => d.display_id?.startsWith('KL-'));
        let maxId = 0;
        klDocs.forEach(d => {
          const num = parseInt(d.display_id!.replace('KL-', ''));
          if (!isNaN(num) && num > maxId) maxId = num;
        });
        const nextIdStr = `KL-${String(maxId + 1).padStart(4, '0')}`;
        
        const newRef = await addDoc(collection(db, 'data_list_klaim'), {
          ...finalData,
          display_id: nextIdStr,
          created_at: serverTimestamp()
        });
        
        await logActivity(newRef.id, "Created Klaim", `Created Klaim ${nextIdStr}`);

        // Handle offline file uploads
        if (pendingFiles.length > 0) {
          toast.success("Creating klaim and uploading files...");
          let uploadedCount = 0;
          for (const file of pendingFiles) {
            const uploadData = new FormData();
            uploadData.append('file', file);
            const res = await apiFetch(`/api/klaim/${newRef.id}/attachments`, {
              method: 'POST',
              body: uploadData
            });
            if (res.ok) uploadedCount++;
          }
          if (uploadedCount > 0) toast.success(`Successfully uploaded ${uploadedCount} file(s)`);
        } else {
          toast.success("New Klaim created");
        }
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
       const fd = new Date(dateStr);
       return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(fd);
    } catch (e) {
      return dateStr;
    }
  };

  const renderFilterSelect = (
    label: string, 
    options: string[], 
    selectedValues: string[], 
    onChange: (vals: string[]) => void
  ) => {
    return (
      <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
        <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
        <div className="flex flex-wrap gap-2 p-2 bg-[var(--bg-secondary)] rounded-md border border-[var(--border-color)] max-h-32 overflow-y-auto">
          {options.length === 0 && <span className="text-xs text-[var(--text-muted)] italic py-1">No options</span>}
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-surface)] px-2 py-1 rounded w-full">
              <input
                type="checkbox"
                checked={selectedValues.includes(opt)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selectedValues, opt]);
                  else onChange(selectedValues.filter(v => v !== opt));
                }}
                className="rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--accent-color)]"
              />
              <span className="text-sm text-[var(--text-primary)] truncate">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const activeFiltersCount = selectedTypes.length + selectedStatus.length + selectedWHP.length;

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
            
            {/* Status Submenu */}
            <div className="relative group/status px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
              <span className="font-medium">Status {selectedStatus.length > 0 && `(${selectedStatus.length})`}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/status:text-[var(--text-primary)]" />
              
              <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                <div className="space-y-1">
                  {["Open", "In Progress", "Pending Finance", "Done"].map(st => (
                    <label key={`fs-${st}`} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedStatus.includes(st)}
                        onChange={() => toggleArrayItem(setSelectedStatus, st)} 
                        className="rounded border-gray-300 dark:border-gray-600 bg-[var(--bg-primary)] h-3.5 w-3.5" 
                      />
                      <span className="text-sm text-[var(--text-primary)]">{st}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Type Submenu */}
            {uniqueClaimTypes.length > 0 && (
              <div className="relative group/type px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                <span className="font-medium">Claim Type {selectedTypes.length > 0 && `(${selectedTypes.length})`}</span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/type:text-[var(--text-primary)]" />
                
                <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/type:opacity-100 group-hover/type:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                  <div className="space-y-1">
                    {uniqueClaimTypes.map(t => (
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

            {/* WHP Name Submenu */}
            {uniqueWHPs.length > 0 && (
              <div className="relative group/whp px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                <span className="font-medium">WHP Name {selectedWHP.length > 0 && `(${selectedWHP.length})`}</span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/whp:text-[var(--text-primary)]" />
                
                <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/whp:opacity-100 group-hover/whp:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                  <div className="space-y-1">
                    {uniqueWHPs.map(w => (
                      <label key={`fw-${w}`} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedWHP.includes(w)}
                          onChange={() => toggleArrayItem(setSelectedWHP, w)} 
                          className="rounded border-gray-300 dark:border-gray-600 bg-[var(--bg-primary)] h-3.5 w-3.5" 
                        />
                        <span className="text-sm text-[var(--text-primary)]">{w}</span>
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
                setSelectedStatus([]);
                setSelectedWHP([]);
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
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-sm flex flex-col overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <ListIcon className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-secondary)] mb-2">No Klaim found</h3>
            <p className="text-sm text-[var(--text-muted)]">Check your filters or create a new klaim.</p>
          </div>
        ) : (
          <>
          <div className="flex-1 overflow-auto overflow-x-auto min-w-0 pb-10">
            <table className="w-full text-left border-collapse table-fixed select-none">
              <thead className="bg-[var(--bg-surface)] sticky top-0 z-10 shadow-[0_1px_0_var(--border-color)]">
                <tr>
                  {[
                    { key: 'display_id', label: 'ID' },
                    { key: 'claim_type', label: 'Claim Type' },
                    { key: 'whp_name', label: 'WHP Name' },
                    { key: 'invoice_date', label: 'Invoice Date' },
                    { key: 'invoice_no', label: 'Invoice No' },
                    { key: 'description', label: 'Description' },
                    { key: 'claim_value', label: 'Claim Value' },
                    { key: 'due', label: 'Due' },
                    { key: 'status', label: 'Status' }
                  ].map((col) => (
                    <th 
                      key={col.key} 
                      className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                      style={{ width: colWidths[col.key] || 150 }}
                      onClick={() => handleSort(col.key as keyof DataListKlaim)}
                    >
                      <div className="flex items-center gap-1 overflow-hidden">
                         <span className="truncate">{col.label}</span>
                         {sortField === col.key ? (
                           sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-[var(--accent-color)] flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-[var(--accent-color)] flex-shrink-0" />
                         ) : (
                           <div className="w-3" />
                         )}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 z-10 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setResizingCol({ key: col.key, startX: e.clientX, startWidth: colWidths[col.key] || 150 });
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {currentData.map((item, idx) => {
                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-[var(--bg-secondary)] transition-colors group cursor-pointer"
                      onClick={() => openEditModal(item)}
                    >
                      <td className="px-4 py-2 truncate text-[var(--text-primary)] font-medium" style={{ maxWidth: colWidths.display_id }}>
                        {item.display_id || '-'}
                      </td>
                      <td className="px-4 py-2 truncate text-[var(--text-secondary)]" style={{ maxWidth: colWidths.claim_type }}>
                        {item.claim_type || '-'}
                      </td>
                      <td className="px-4 py-2 truncate text-[var(--text-secondary)]" style={{ maxWidth: colWidths.whp_name }}>
                        {item.whp_name || '-'}
                      </td>
                      <td className="px-4 py-2 truncate text-[var(--text-secondary)]" style={{ maxWidth: colWidths.invoice_date }}>
                        {formatDate(item.invoice_date)}
                      </td>
                      <td className="px-4 py-2 truncate text-[var(--text-secondary)] font-mono text-xs" style={{ maxWidth: colWidths.invoice_no }}>
                        {item.invoice_no || '-'}
                      </td>
                      <td className="px-4 py-2 truncate text-[var(--text-secondary)]" style={{ maxWidth: colWidths.description }}>
                        <span title={item.description}>{item.description || '-'}</span>
                      </td>
                      <td className="px-4 py-2 truncate text-[var(--text-secondary)] font-mono text-xs" style={{ maxWidth: colWidths.claim_value }}>
                        {formatCurrency(item.claim_value)}
                      </td>
                      <td className="px-4 py-2 truncate text-[var(--text-primary)] font-mono font-medium text-xs" style={{ maxWidth: colWidths.due }}>
                        {formatCurrency(item.due)}
                      </td>
                      <td className="px-4 py-2 truncate" style={{ maxWidth: colWidths.status }} onClick={(e) => e.stopPropagation()}>
                         {updatingStatusId === item.id ? (
                           <div className="flex items-center gap-2">
                             <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-color)]" />
                             <span className="text-xs text-[var(--text-secondary)]">Updating...</span>
                           </div>
                         ) : (
                           <select
                              value={item.status}
                              onChange={(e) => handleStatusChange(item.id, e.target.value, item.status)}
                              className={`text-xs font-semibold px-2 py-1 rounded-full border-0 focus:ring-2 focus:ring-[var(--border-focus)] appearance-none cursor-pointer ${getStatusBadgeClass(item.status)}`}
                           >
                             <option value="Open">Open</option>
                             <option value="In Progress">In Progress</option>
                             <option value="Pending Finance">Pending Fin</option>
                             <option value="Done">Done</option>
                           </select>
                         )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        
        {/* Pagination */}
        {filteredData.length > 0 && (
          <div className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-4 shrink-0 mt-auto">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Show</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="text-xs border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                >
                  {[20, 50, 100, 200].map(v => (
                    <option className="bg-[var(--bg-body)] text-[var(--text-primary)] font-medium" key={v} value={v}>{v}</option>
                  ))}
                </select>
                <span className="text-xs text-[var(--text-muted)]">per page</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-[var(--bg-primary)] disabled:opacity-30 transition-colors text-[var(--text-secondary)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {getPageNumbers(currentPage, totalPages).map((p, i) => (
                  <button
                    key={`${p}-${i}`}
                    onClick={() => typeof p === 'number' && setCurrentPage(p)}
                    disabled={p === '...'}
                    className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded transition-all ${
                      p === currentPage
                        ? 'bg-[var(--accent-color)] text-white'
                        : p === '...'
                        ? 'text-[var(--text-muted)] cursor-default'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary-hover)] cursor-pointer'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-[var(--bg-primary)] disabled:opacity-30 transition-colors text-[var(--text-secondary)]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {editingItem ? 'Edit Klaim' : 'New Klaim'} 
                {editingItem && <span className="text-sm font-normal text-[var(--text-muted)] ml-2">{editingItem.display_id}</span>}
              </h2>
              <div className="flex items-center gap-2">
                {editingItem && (
                  <>
                    {!showDeleteConfirm ? (
                       <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete Klaim"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-sm font-medium text-red-500">Delete klaim?</span>
                        <button 
                          onClick={() => handleDelete(editingItem.id)}
                          disabled={!!isDeleting}
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          Yes
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={!!isDeleting}
                          className="px-2 py-1 text-xs border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] disabled:opacity-50 text-[var(--text-primary)]"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button onClick={() => !isSaving && !isDeleting && setIsModalOpen(false)} className="text-[var(--text-secondary)] hover:text-red-500 transition-colors bg-[var(--bg-secondary)] hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Claim Type <span className="text-red-500">*</span></label>
                  <input
                    list="claimTypeOptions"
                    value={formData.claim_type}
                    onChange={(e) => setFormData({ ...formData, claim_type: e.target.value })}
                    className="input-field"
                    placeholder="e.g. C01"
                    required
                  />
                  <datalist id="claimTypeOptions">
                    {uniqueClaimTypes.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Invoice Date</label>
                  <input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Invoice No</label>
                  <input
                    value={formData.invoice_no}
                    onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                    className="input-field"
                    placeholder="INV-XXXXX"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Subject Email</label>
                  <input
                    value={formData.subject_email}
                    onChange={(e) => setFormData({ ...formData, subject_email: e.target.value })}
                    className="input-field"
                    placeholder="Title of email thread"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field min-h-[80px]"
                  placeholder="Klaim description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-color)] pt-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">WHP Name <span className="text-red-500">*</span></label>
                  <input
                    list="whpNameOptions"
                    value={formData.whp_name}
                    onChange={handleWHPChange}
                    className="input-field"
                    placeholder="Enter WHP name"
                    required
                  />
                  <datalist id="whpNameOptions">
                    {uniqueWHPs.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Partner <span className="text-red-500">*</span></label>
                  <input
                    list="partnerOptions"
                    value={formData.partner}
                    onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
                    className="input-field"
                    placeholder="Select or enter partner"
                    required
                  />
                  <datalist id="partnerOptions">
                    {uniquePartners.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Subsidiary <span className="text-red-500">*</span></label>
                  <input
                    list="subsidiaryOptions"
                    value={formData.subsidiary}
                    onChange={(e) => setFormData({ ...formData, subsidiary: e.target.value })}
                    className="input-field"
                    required
                  />
                  <datalist id="subsidiaryOptions">
                    {uniqueSubsidiaries.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="input-field"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending Finance">Pending Finance</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-[var(--border-color)] pt-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Claim Value</label>
                  <input
                    type="number"
                    value={formData.claim_value || ''}
                    onChange={(e) => handleClaimValueTaxChange('claim_value', e.target.value)}
                    className="input-field font-mono"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Tax</label>
                  <input
                    type="number"
                    value={formData.tax || ''}
                    onChange={(e) => handleClaimValueTaxChange('tax', e.target.value)}
                    className="input-field font-mono"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--accent-color)]">Due (Calculated)</label>
                  <input
                    type="text"
                    value={formatCurrency((formData.claim_value || 0) + (formData.tax || 0))}
                    className="input-field bg-[var(--bg-secondary)] font-mono font-bold text-[var(--text-primary)]"
                    disabled
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-2">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Remark</label>
                <input
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="input-field"
                  placeholder="Additional notes"
                />
              </div>

              {editingItem && formData.invoice_date && (
                <>
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-color)] mt-2">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">
                      Link Data (External Folder)
                    </label>
                    <div className="flex gap-2">
                       <input
                         value={formData.link_data}
                         onChange={(e) => setFormData({ ...formData, link_data: e.target.value })}
                         className="input-field flex-1 text-blue-500"
                         placeholder="https://drive.google.com/..."
                       />
                       {formData.link_data && (
                          <a 
                            href={formData.link_data} 
                            target="_blank" 
                            rel="noreferrer"
                            className="btn-secondary px-3 rounded text-sm flex items-center justify-center min-w-[80px]"
                          >
                             Open
                          </a>
                       )}
                    </div>
                  </div>

                  {/* Attachments Section */}
                  <div className="mt-6 border border-[var(--border-color)] rounded-lg p-4 bg-[var(--bg-secondary)] pb-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        ATTACHMENTS
                      </h3>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          ref={fileInputRef}
                          onChange={(e) => handleFileUpload(e.target.files)}
                        />
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 rounded transition-colors disabled:opacity-50"
                        >
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {isUploading ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>
                    </div>

                <div 
                  className={`min-h-[100px] border-2 border-dashed border-[var(--border-color)] rounded-lg p-4 transition-colors ${pendingFiles.length > 0 || (attachments && attachments.length > 0) ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--bg-surface)]' : 'flex flex-col items-center justify-center bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)]'}`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e.dataTransfer.files); }}
                >
                  {editingItem && attachments && attachments.length > 0 && (
                    <>
                      {attachments.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--accent-color)] transition-colors group/item">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded bg-[var(--accent-color)]/10 flex items-center justify-center shrink-0">
                              <svg className="w-5 h-5 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--text-primary)] truncate" title={file.name || file.original_name}>
                                {file.name || file.original_name || 'Unnamed file'}
                              </p>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                {file.size ? (file.size / 1024).toFixed(2) : 0} KB
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                            {file.url && (
                              <a 
                                href={file.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded transition-colors"
                                title="Download"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(file.id)}
                              disabled={isDeletingAttachment === file.id}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                               {isDeletingAttachment === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {pendingFiles && pendingFiles.length > 0 && (
                    <>
                      {pendingFiles.map((file, idx) => (
                         <div key={`pending-${idx}`} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] opacity-70">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-10 h-10 rounded bg-[var(--accent-color)]/10 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[var(--text-primary)] truncate" title={file.name}>{file.name}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">Pending upload...</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                         </div>
                      ))}
                    </>
                  )}

                  {(!attachments || attachments.length === 0) && (!pendingFiles || pendingFiles.length === 0) && (
                    <div className="col-span-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-2">
                       <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                       </svg>
                       <span className="text-sm font-medium">
                         No attachments yet
                       </span>
                       <span className="text-xs text-center opacity-70">
                         Drag & drop files here or click Upload button
                       </span>
                    </div>
                  )}
                </div>
              </div>
              </>
              )}

              {/* Activity Log */}
              {editingItem && (
                <div className="mt-8">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2 uppercase">
                    <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Activity Log
                  </h3>
                  <div className="space-y-4">
                    {activities.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)] pb-4">No activity recorded yet.</p>
                    ) : (
                      activities.map((activity, index) => (
                        <div key={activity.id} className="relative pl-6">
                           {index !== activities.length - 1 && (
                             <div className="absolute left-[7px] top-[24px] bottom-[-20px] w-px bg-[var(--border-color)]"></div>
                           )}
                           <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-[var(--bg-surface)] border-2 border-[var(--border-color)] flex items-center justify-center shadow-sm">
                             <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]"></div>
                           </div>
                           <div className="text-sm">
                             <span className="font-bold text-[var(--text-primary)]">{activity.user}</span>
                             <span className="text-[var(--text-secondary)] ml-1">{activity.action}</span>
                           </div>
                           {activity.details && (
                             <div className="text-sm text-[var(--text-secondary)] mt-1 whitespace-pre-wrap">{activity.details}</div>
                           )}
                           <div className="text-xs text-[var(--text-muted)] mt-1">
                             {new Date(activity.created_at).toLocaleString('id-ID', {
                               day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                             })}
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-none p-6 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-secondary)] rounded-b-xl">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="btn-secondary px-4 py-2"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving || !formData.claim_type || !formData.whp_name || !formData.partner || !formData.subsidiary}
                className="btn-primary px-6 py-2 rounded flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {isSaving ? 'Saving...' : 'Save Klaim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default DataListKlaimView;
