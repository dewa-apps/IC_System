import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { DataListKlaim } from '../types';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Trash2, Edit2, ExternalLink, ChevronUp, ChevronDown, X, ChevronLeft, ChevronRight, Filter, Upload, File as FileIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export interface DataListKlaimViewRef {
  openAddModal: () => void;
}

interface DataListKlaimViewProps {
  dataKlaim: DataListKlaim[];
  searchQuery: string;
  onClearSearch?: () => void;
  metadataOptions: {
    claim_type_klaim: string[];
    whp_name_klaim: string[];
    subsidiary_klaim: string[];
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
    case 'Open': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800';
    case 'In Progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
    case 'Pending Finance': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800';
    case 'Done': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
  }
};

const DataListKlaimView = forwardRef<DataListKlaimViewRef, DataListKlaimViewProps>(({ dataKlaim, searchQuery, onClearSearch, metadataOptions }, ref) => {
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedWHP, setSelectedWHP] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string[]>([]);

  // Sort
  const [sortField, setSortField] = useState<keyof DataListKlaim>('invoice_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, value: string) => {
    setUpdatingStatusId(id);
    try {
      await updateDoc(doc(db, 'data_list_klaim', id), { status: value });
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
    claim_type: 120,
    whp_name: 150,
    invoice_date: 120,
    invoice_no: 120,
    description: 200,
    claim_value: 120,
    due: 120,
    status: 140
  });
  const [resizingCol, setResizingCol] = useState<{ key: string, startX: number, startWidth: number } | null>(null);
  const isResizingRef = React.useRef(false);

  const uniqueClaimTypes = useMemo(() => Array.from(new Set([...(metadataOptions?.claim_type_klaim || []), ...dataKlaim.map(j => j.claim_type).filter(Boolean)])).sort(), [metadataOptions, dataKlaim]);
  const uniqueWHPNames = useMemo(() => Array.from(new Set([...(metadataOptions?.whp_name_klaim || []), ...dataKlaim.map(j => j.whp_name).filter(Boolean)])).sort(), [metadataOptions, dataKlaim]);
  const uniqueSubsidiaries = useMemo(() => Array.from(new Set([...(metadataOptions?.subsidiary_klaim || []), ...dataKlaim.map(j => j.subsidiary).filter(Boolean)])).sort(), [metadataOptions, dataKlaim]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKlaim, setEditingKlaim] = useState<DataListKlaim | null>(null);
  const [formData, setFormData] = useState({
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
    status: 'Open' as 'Open' | 'In Progress' | 'Pending Finance' | 'Done',
    remark: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Derive Partner logic
  const whpPartnerMap = useMemo(() => {
    const map = new Map<string, string>();
    dataKlaim.forEach(k => {
      if (k.whp_name && k.partner) map.set(k.whp_name, k.partner);
    });
    return map;
  }, [dataKlaim]);

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

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    openAddModal: () => {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newDisplayId = `K-${randomNum}`;
      
      setEditingKlaim(null);
      setFormData({
        claim_type: '', invoice_date: '', invoice_no: '', description: '', subject_email: '',
        link_data: '', whp_name: '', partner: '', claim_value: 0, tax: 0, subsidiary: '',
        status: 'Open', remark: '',
        display_id: newDisplayId // Hold temporary ID
      } as any);
      setIsModalOpen(true);
    }
  }));

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingKlaim(null);
    setShowDeleteConfirm(false);
  };

  const handleWHPNameChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      whp_name: val,
      partner: whpPartnerMap.has(val) ? whpPartnerMap.get(val)! : prev.partner
    }));
  };

  const calculateDue = (val: number, tx: number) => {
    return (val || 0) + (tx || 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.claim_type || !formData.invoice_date || !formData.whp_name) {
      toast.error('Please fill required fields (Claim Type, Invoice Date, WHP Name)');
      return;
    }

    setIsSaving(true);
    const codePrefix = `K-`;
    const currentEditingKlaim = editingKlaim;
    closeModal();
    
    try {
      const dueCalculated = calculateDue(formData.claim_value, formData.tax);
      const saveData = {
        ...formData,
        due: dueCalculated,
        updated_at: serverTimestamp(),
      };

      if (currentEditingKlaim) {
        // Strip out display_id from formData before update if we pushed it
        const { display_id, ...updateData } = saveData as any;
        await updateDoc(doc(db, 'data_list_klaim', currentEditingKlaim.id), updateData);
        toast.success('Klaim updated successfully');
      } else {
        const dbRef = collection(db, 'data_list_klaim');
        const newDisplayId = (formData as any).display_id || `${codePrefix}${Math.floor(1000 + Math.random() * 9000)}`;
        
        // Ensure display_id is explicitly set
        const { display_id, ...insertData } = saveData as any;
        await addDoc(dbRef, {
          ...insertData,
          display_id: newDisplayId,
          created_at: serverTimestamp()
        });
        toast.success('Klaim added successfully');
      }
      
      // Update options
      if (formData.claim_type && !uniqueClaimTypes.includes(formData.claim_type)) {
        await setDoc(doc(db, 'metadata', 'options'), { claim_type_klaim: arrayUnion(formData.claim_type) }, { merge: true });
      }
      if (formData.whp_name && !uniqueWHPNames.includes(formData.whp_name)) {
        await setDoc(doc(db, 'metadata', 'options'), { whp_name_klaim: arrayUnion(formData.whp_name) }, { merge: true });
      }
      if (formData.subsidiary && !uniqueSubsidiaries.includes(formData.subsidiary)) {
        await setDoc(doc(db, 'metadata', 'options'), { subsidiary_klaim: arrayUnion(formData.subsidiary) }, { merge: true });
      }

    } catch (error) {
      console.error(error);
      toast.error('Failed to save Klaim');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingKlaim) return;
    setIsDeleting(true);
    const currentId = editingKlaim.id;
    closeModal();
    
    try {
      await deleteDoc(doc(db, 'data_list_klaim', currentId));
      toast.success('Klaim deleted successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete Klaim');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!formData.invoice_date) {
      toast.error('Please input Invoice Date first to upload file');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading file...');
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      const gasUrl = "/api/gas-proxy";
      const gasResponse = await fetch('/api/gas-proxy', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadKlaim',
          base64: base64Data,
          fileName: file.name,
          mimeType: file.type,
          invoiceDate: formData.invoice_date,
          whpName: formData.whp_name,
          klaimId: editingKlaim?.display_id || (formData as any).display_id || 'New-Klaim'
        })
      });

      if (!gasResponse.ok) {
        throw new Error(await gasResponse.text());
      }
      const data = await gasResponse.json();
      if (data.status === 'success') {
        setFormData(prev => ({ ...prev, link_data: data.folderUrl }));
        toast.success('File uploaded! Link Data updated.', { id: toastId });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      console.error("Upload failed", error);
      toast.error('Failed to upload file: ' + error.message, { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filter 
  const filteredData = useMemo(() => {
    let result = dataKlaim;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.display_id || '').toLowerCase().includes(q) ||
        (item.claim_type || '').toLowerCase().includes(q) ||
        (item.whp_name || '').toLowerCase().includes(q) ||
        (item.invoice_no || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    }

    if (selectedStatus.length > 0) result = result.filter(item => selectedStatus.includes(item.status));
    if (selectedWHP.length > 0) result = result.filter(item => selectedWHP.includes(item.whp_name));
    if (selectedType.length > 0) result = result.filter(item => selectedType.includes(item.claim_type));

    result = result.sort((a, b) => {
      let aVal = a[sortField] as any;
      let bVal = b[sortField] as any;
      
      if (!aVal) aVal = '';
      if (!bVal) bVal = '';

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [dataKlaim, searchQuery, selectedStatus, selectedWHP, selectedType, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const currentData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  const toggleSort = (field: keyof DataListKlaim) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSortClick = (e: React.MouseEvent, field: keyof DataListKlaim) => {
    if (isResizingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    toggleSort(field);
  };

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const dt = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${dt.getDate().toString().padStart(2, '0')} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={() => {
             const randomNum = Math.floor(1000 + Math.random() * 9000);
             const newDisplayId = `K-${randomNum}`;
             setEditingKlaim(null);
             setFormData({
                claim_type: '', invoice_date: '', invoice_no: '', description: '', subject_email: '',
                link_data: '', whp_name: '', partner: '', claim_value: 0, tax: 0, subsidiary: '',
                status: 'Open', remark: '', display_id: newDisplayId
             } as any);
             setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Data Klaim
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4 overflow-x-auto pb-2">
         {/* WHP Name Filter */}
         <div className="relative group min-w-[200px]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg cursor-pointer">
            <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)] flex-1">
              WHP Name {selectedWHP.length > 0 && `(${selectedWHP.length})`}
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          </div>
          <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 max-h-64 overflow-y-auto">
            <div className="p-2 space-y-1">
              {['All', ...uniqueWHPNames].map(name => {
                const isActive = name === 'All' ? selectedWHP.length === 0 : selectedWHP.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => {
                      if (name === 'All') setSelectedWHP([]);
                      else {
                        setSelectedWHP(prev => 
                          prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
                        );
                      }
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    {name === 'All' ? 'Select All' : name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Claim Type Filter */}
        <div className="relative group min-w-[200px]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg cursor-pointer">
            <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)] flex-1">
              Claim Type {selectedType.length > 0 && `(${selectedType.length})`}
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          </div>
          <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 max-h-64 overflow-y-auto">
            <div className="p-2 space-y-1">
              {['All', ...uniqueClaimTypes].map(type => {
                const isActive = type === 'All' ? selectedType.length === 0 : selectedType.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (type === 'All') setSelectedType([]);
                      else {
                        setSelectedType(prev => 
                          prev.includes(type) ? prev.filter(n => n !== type) : [...prev, type]
                        );
                      }
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    {type === 'All' ? 'Select All' : type}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="relative group min-w-[200px]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg cursor-pointer">
            <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)] flex-1">
              Status {selectedStatus.length > 0 && `(${selectedStatus.length})`}
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          </div>
          <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
            <div className="p-2 space-y-1">
              {['All', 'Open', 'In Progress', 'Pending Finance', 'Done'].map(status => {
                const isActive = status === 'All' ? selectedStatus.length === 0 : selectedStatus.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => {
                      if (status === 'All') setSelectedStatus([]);
                      else {
                        setSelectedStatus(prev => 
                          prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                        );
                      }
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    {status === 'All' ? 'Select All' : status}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border-color)]">
              <tr>
                {[
                  { key: 'display_id', label: 'ID' },
                  { key: 'claim_type', label: 'Claim Type' },
                  { key: 'whp_name', label: 'WHP Name' },
                  { key: 'invoice_date', label: 'Invoice Date' },
                  { key: 'invoice_no', label: 'Invoice No.' },
                  { key: 'description', label: 'Description' },
                  { key: 'claim_value', label: 'Claim Value' },
                  { key: 'due', label: 'Due' },
                  { key: 'status', label: 'Status' },
                  { key: 'actions', label: 'Actions' }
                ].map(({ key, label }) => (
                  <th 
                    key={key} 
                    className="relative px-4 py-3 font-medium select-none cursor-pointer hover:bg-[var(--bg-hover)] transition-colors group"
                    style={{ width: colWidths[key] || 'auto', minWidth: key === 'actions' ? 100 : Math.max(50, colWidths[key] || 100) }}
                    onClick={(e) => key !== 'actions' && handleSortClick(e, key as keyof DataListKlaim)}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      {sortField === key && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-[var(--accent-color)]" /> : <ChevronDown className="w-3 h-3 text-[var(--accent-color)]" />
                      )}
                    </div>
                    {key !== 'actions' && (
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-500 cursor-col-resize z-10 transition-colors"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onMouseDown={(e) => handleResizeStart(e, key)}
                        />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {currentData.length > 0 ? (
                currentData.map(item => (
                  <tr key={item.id} className="hover:bg-[var(--bg-hover)] group transition-colors">
                    <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                        {item.link_data ? (
                           <a href={item.link_data} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                              {item.display_id} <ExternalLink className="w-3 h-3" />
                           </a>
                        ) : (
                           item.display_id
                        )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{item.claim_type}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{item.whp_name}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDateStr(item.invoice_date)}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{item.invoice_no}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs truncate" title={item.description}>{item.description}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">Rp {item.claim_value?.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] font-medium">Rp {item.due?.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        disabled={updatingStatusId === item.id}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusBadgeClass(item.status)} appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        style={{ paddingRight: '20px', backgroundPosition: 'right 4px center' }}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending Finance">Pending Finance</option>
                        <option value="Done">Done</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => {
                          setEditingKlaim(item);
                          setFormData({
                            claim_type: item.claim_type || '', invoice_date: item.invoice_date || '', invoice_no: item.invoice_no || '',
                            description: item.description || '', subject_email: item.subject_email || '', link_data: item.link_data || '',
                            whp_name: item.whp_name || '', partner: item.partner || '', claim_value: item.claim_value || 0,
                            tax: item.tax || 0, subsidiary: item.subsidiary || '', status: item.status || 'Open', remark: item.remark || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Edit Claim"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    No Klaim data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-secondary)]">Show</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {[10, 20, 50, 100, 250].map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
            <span className="text-sm text-[var(--text-secondary)]">entries</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} entries
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-[var(--border-color)] rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {getPageNumbers(currentPage, totalPages).map((pageNum, idx) => (
              <button
                key={idx}
                onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                disabled={pageNum === '...'}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm ${
                  pageNum === currentPage
                    ? 'bg-[var(--accent-color)] text-white'
                    : pageNum === '...'
                    ? 'text-[var(--text-secondary)] cursor-default'
                    : 'border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-[var(--border-color)] rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[var(--bg-surface)]/95 backdrop-blur z-10 border-b border-[var(--border-color)] p-4 sm:p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {editingKlaim ? `Edit Klaim (${editingKlaim.display_id})` : 'Add New Klaim'}
                </h2>
              </div>
              <button onClick={closeModal} className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 {/* Claim Type */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Claim Type *</label>
                    <input 
                      type="text"
                      list="claim-type-options"
                      required
                      value={formData.claim_type}
                      onChange={e => setFormData({ ...formData, claim_type: e.target.value })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                      placeholder="e.g. Diskon"
                    />
                    <datalist id="claim-type-options">
                      {uniqueClaimTypes.map(c => <option key={c} value={c} />)}
                    </datalist>
                 </div>

                 {/* WHP Name */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">WHP Name *</label>
                    <input 
                      type="text"
                      list="whp-name-options"
                      required
                      value={formData.whp_name}
                      onChange={e => handleWHPNameChange(e.target.value)}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                      placeholder="e.g. WHP-001"
                    />
                    <datalist id="whp-name-options">
                      {uniqueWHPNames.map(c => <option key={c} value={c} />)}
                    </datalist>
                 </div>

                 {/* Partner */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Partner</label>
                    <input 
                      type="text"
                      value={formData.partner}
                      onChange={e => setFormData({ ...formData, partner: e.target.value })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                      placeholder="Partner Name"
                    />
                 </div>

                 {/* Invoice Date */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Invoice Date *</label>
                    <input 
                      type="date"
                      required
                      value={formData.invoice_date}
                      onChange={e => setFormData({ ...formData, invoice_date: e.target.value })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                    />
                 </div>

                 {/* Invoice No */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Invoice No</label>
                    <input 
                      type="text"
                      value={formData.invoice_no}
                      onChange={e => setFormData({ ...formData, invoice_no: e.target.value })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                    />
                 </div>

                 {/* Subsidiary */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Subsidiary</label>
                    <input 
                      type="text"
                      list="subsidiary-options"
                      value={formData.subsidiary}
                      onChange={e => setFormData({ ...formData, subsidiary: e.target.value })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                    />
                    <datalist id="subsidiary-options">
                      {uniqueSubsidiaries.map(c => <option key={c} value={c} />)}
                    </datalist>
                 </div>

                 {/* Claim Value */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Claim Value</label>
                    <input 
                      type="number"
                      value={formData.claim_value}
                      onChange={e => setFormData({ ...formData, claim_value: Number(e.target.value) })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                    />
                 </div>

                 {/* Tax */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Tax</label>
                    <input 
                      type="number"
                      value={formData.tax}
                      onChange={e => setFormData({ ...formData, tax: Number(e.target.value) })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                    />
                 </div>

                 {/* Due */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Due (Auto-calculated)</label>
                    <input 
                      type="text"
                      readOnly
                      disabled
                      value={`Rp ${calculateDue(formData.claim_value, formData.tax).toLocaleString('id-ID')}`}
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] text-sm rounded-lg px-3 py-2 cursor-not-allowed font-medium"
                    />
                 </div>

                 {/* Status */}
                 <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending Finance">Pending Finance</option>
                      <option value="Done">Done</option>
                    </select>
                 </div>
              </div>

              {/* Description */}
              <div>
                 <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Description</label>
                 <textarea 
                   rows={3}
                   value={formData.description}
                   onChange={e => setFormData({ ...formData, description: e.target.value })}
                   className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                 />
              </div>

              {/* Subject Email */}
              <div>
                 <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Subject Email</label>
                 <input 
                   type="text"
                   value={formData.subject_email}
                   onChange={e => setFormData({ ...formData, subject_email: e.target.value })}
                   className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                 />
              </div>

              {/* Remark */}
              <div>
                 <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Remark</label>
                 <textarea 
                   rows={2}
                   value={formData.remark}
                   onChange={e => setFormData({ ...formData, remark: e.target.value })}
                   className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                 />
              </div>

               {/* File Upload / Link Data */}
               <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">Link Data (Google Drive Folder)</label>
                  
                  {formData.link_data ? (
                     <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-color)] p-3 rounded-lg mb-4">
                        <div className="flex items-center gap-3 overflow-hidden">
                           <FileIcon className="w-5 h-5 text-blue-500 shrink-0" />
                           <a href={formData.link_data} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline truncate">
                              {formData.link_data}
                           </a>
                        </div>
                        <button
                           type="button"
                           onClick={() => setFormData({ ...formData, link_data: '' })}
                           className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors ml-2 shrink-0"
                           title="Clear Link"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                  ) : (
                     <div className="mb-4">
                        <input
                           type="text"
                           value={formData.link_data}
                           onChange={e => setFormData({ ...formData, link_data: e.target.value })}
                           placeholder="Paste Google Drive folder link here or use the upload button below..."
                           className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
                        />
                     </div>
                  )}

                  {formData.invoice_date ? (
                     <div className="flex items-center justify-center w-full">
                        <input 
                           type="file" 
                           id="klaim-file-upload" 
                           className="hidden" 
                           ref={fileInputRef}
                           onChange={handleUploadFile}
                           disabled={isUploading}
                        />
                        <label 
                           htmlFor="klaim-file-upload" 
                           className={`flex flex-col items-center justify-center w-full h-24 border-2 border-[var(--border-color)] border-dashed rounded-lg cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
                        >
                           <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {isUploading ? (
                                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                              ) : (
                                 <Upload className="w-8 h-8 text-[var(--text-secondary)] mb-2" />
                              )}
                              <p className="mb-2 text-sm text-[var(--text-secondary)]">
                                 <span className="font-semibold text-[var(--text-primary)]">Click to upload</span> to Google Drive
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">Automatic folder creation based on Invoice Date, WHP, and ID</p>
                           </div>
                        </label>
                     </div>
                  ) : (
                     <p className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                        Please select an <strong>Invoice Date</strong> to enable automatic file upload to Google Drive.
                     </p>
                  )}
               </div>

              <div className="flex items-center justify-between pt-6 border-t border-[var(--border-color)]">
                {editingKlaim ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                ) : <div />}
                
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Klaim'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Delete Klaim</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Are you sure you want to delete <span className="font-semibold text-[var(--text-primary)]">{editingKlaim?.display_id}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DataListKlaimView.displayName = 'DataListKlaimView';

export default DataListKlaimView;
