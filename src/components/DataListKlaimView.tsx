import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { DataListKlaim } from '../types';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Plus, Trash2, Edit2, ExternalLink, ChevronUp, ChevronDown, ListIcon, X, ChevronLeft, ChevronRight, Filter, Upload, Loader2 } from 'lucide-react';
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
    return dataKlaim.filter(item => {
      const ms = searchQuery.toLowerCase();
      const matchSearch = ms === '' || 
        (item.display_id || '').toLowerCase().includes(ms) ||
        (item.invoice_no || '').toLowerCase().includes(ms) ||
        (item.description || '').toLowerCase().includes(ms) ||
        (item.whp_name || '').toLowerCase().includes(ms);

      const matchType = selectedTypes.length === 0 || selectedTypes.includes(item.claim_type);
      const matchStatus = selectedStatus.length === 0 || selectedStatus.includes(item.status);
      const matchWHP = selectedWHP.length === 0 || selectedWHP.includes(item.whp_name);

      return matchSearch && matchType && matchStatus && matchWHP;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      
      if (valA === undefined) valA = '';
      if (valB === undefined) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [dataKlaim, searchQuery, selectedTypes, selectedStatus, selectedWHP, sortField, sortOrder]);

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
  const [isUploading, setIsUploading] = useState(false);

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

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openAddModal: () => {
      setEditingItem(null);
      setFormData({
        claim_type: '',
        invoice_date: new Date().toISOString().split('T')[0],
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
    if (!window.confirm("Are you sure you want to delete this klaim data?")) return;
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'data_list_klaim', id));
      toast.success("Deleted successfully");
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
        
        await addDoc(collection(db, 'data_list_klaim'), {
          ...finalData,
          display_id: nextIdStr,
          created_at: serverTimestamp()
        });
        toast.success("New Klaim created");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !editingItem) return;
    const file = e.target.files[0];
    
    if (!formData.invoice_date) {
      toast.error("Please input Invoice Date first");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const gasUrl = "/api/gas-proxy";
        const gasResponse = await apiFetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'uploadFileKlaim',
            fileName: file.name,
            mimeType: file.type,
            base64: base64Data,
            invoiceDate: formData.invoice_date,
            whpName: formData.whp_name,
            klaimId: editingItem.display_id || editingItem.id
          })
        });

        const gasResultText = await gasResponse.text();
        if (!gasResponse.ok) {
           throw new Error(gasResultText || "File upload proxy response not ok");
        }
        
        const data = JSON.parse(gasResultText);
        if (data.status === 'success') {
          // Update the link data with the folder URL
          setFormData(prev => ({ ...prev, link_data: data.folderUrl }));
          // Also save immediately to Firestore
          await updateDoc(doc(db, 'data_list_klaim', editingItem.id), { link_data: data.folderUrl });
          toast.success("File uploaded to GDrive!");
        } else {
          throw new Error(data.message || 'Unknown error from GAS');
        }
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.onerror = (error) => {
        setIsUploading(false);
        toast.error("Failed to read file");
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
    } catch (error: any) {
      setIsUploading(false);
      toast.error('Upload failed: ' + error.message);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-surface)] relative overflow-hidden">
      {/* Top Bar with Filters */}
      <div className="flex-none px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Data List Klaim</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                showFilters || selectedTypes.length > 0 || selectedStatus.length > 0 || selectedWHP.length > 0
                  ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(selectedTypes.length > 0 || selectedStatus.length > 0 || selectedWHP.length > 0) && (
                <span className="ml-1 bg-[var(--accent-color)] text-white text-xs px-1.5 py-0.5 rounded-full">
                  {selectedTypes.length + selectedStatus.length + selectedWHP.length}
                </span>
              )}
            </button>
            {searchQuery && (
               <button onClick={onClearSearch} className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors">
                 <Search className="w-4 h-4" />
                 Clear Search
               </button>
            )}
          </div>
          <div className="text-sm text-[var(--text-secondary)]">
            {filteredData.length} entries
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-sm">
            {renderFilterSelect('Status', ['Open', 'In Progress', 'Pending Finance', 'Done'], selectedStatus, setSelectedStatus)}
            {renderFilterSelect('Claim Type', uniqueClaimTypes, selectedTypes, setSelectedTypes)}
            {renderFilterSelect('WHP Name', uniqueWHPs, selectedWHP, setSelectedWHP)}
          </div>
        )}
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto bg-[var(--bg-body)] p-4">
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <ListIcon className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--text-secondary)] mb-2">No Klaim found</h3>
            <p className="text-[var(--text-muted)]">Check your filters or create a new klaim.</p>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-lg shadow-sm border border-[var(--border-color)] overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none">
                <tr>
                  <th className="px-4 py-3 font-medium text-[var(--text-secondary)] sticky left-0 z-10 w-16 text-center">
                    No
                  </th>
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
                      className="px-4 py-3 font-medium text-[var(--text-secondary)] relative group hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                      style={{ width: colWidths[col.key] || 150, minWidth: 50, maxWidth: colWidths[col.key] || 150 }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden" onClick={() => handleSort(col.key as keyof DataListKlaim)}>
                         <span className="truncate">{col.label}</span>
                         {sortField === col.key && (
                           sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                         )}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize hover:bg-[var(--accent-color)] active:bg-[var(--accent-color)] opacity-0 group-hover:opacity-100 transition-all z-10"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setResizingCol({ key: col.key, startX: e.clientX, startWidth: colWidths[col.key] || 150 });
                        }}
                      />
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium text-[var(--text-secondary)] sticky right-0 z-10 bg-[var(--bg-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {currentData.map((item, idx) => {
                  const no = (currentPage - 1) * rowsPerPage + idx + 1;
                  return (
                    <tr key={item.id} className="hover:bg-[var(--bg-secondary)] transition-colors group">
                      <td className="px-4 py-2 text-center text-[var(--text-secondary)] text-xs sticky left-0 z-10">
                        {no}
                      </td>
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
                      <td className="px-4 py-2 truncate" style={{ maxWidth: colWidths.status }}>
                         {updatingStatusId === item.id ? (
                           <div className="flex items-center gap-2">
                             <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-color)]" />
                             <span className="text-xs text-[var(--text-secondary)]">Updating...</span>
                           </div>
                         ) : (
                           <select
                              value={item.status}
                              onChange={(e) => handleStatusChange(item.id, e.target.value)}
                              className={`text-xs font-semibold px-2 py-1 rounded-full border-0 focus:ring-2 focus:ring-[var(--border-focus)] appearance-none cursor-pointer ${getStatusBadgeClass(item.status)}`}
                           >
                             <option value="Open">Open</option>
                             <option value="In Progress">In Progress</option>
                             <option value="Pending Finance">Pending Fin</option>
                             <option value="Done">Done</option>
                           </select>
                         )}
                      </td>
                      <td className="px-4 py-2 sticky right-0 bg-[var(--bg-surface)] group-hover:bg-[var(--bg-secondary)] transition-colors">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.link_data && (
                            <a 
                              href={item.link_data} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                              title="Open Folder"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button 
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            disabled={isDeleting === item.id}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-none px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent border border-[var(--border-color)] rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] transition-all"
            >
              {[20, 50, 100, 200].map(v => (
                <option key={v} value={v}>{v} rows</option>
              ))}
            </select>
            <span>Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} entries</span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 sm:px-3 sm:py-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Prev</span>
            </button>
            
            <div className="flex items-center gap-1 px-2">
              {getPageNumbers(currentPage, totalPages).map((p, i) => (
                <button
                  key={i}
                  onClick={() => typeof p === 'number' && setCurrentPage(p)}
                  disabled={p === '...'}
                  className={`min-w-[28px] h-[28px] text-xs rounded-md flex items-center justify-center font-medium transition-colors ${
                    p === currentPage
                      ? 'bg-[var(--accent-color)] text-white'
                      : p === '...'
                      ? 'text-[var(--text-muted)] cursor-default'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 sm:px-3 sm:py-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1"
            >
              <span className="hidden sm:inline text-sm">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {editingItem ? 'Edit Klaim' : 'New Klaim'} 
                {editingItem && ` - ${editingItem.display_id}`}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-secondary)] hover:text-red-500 transition-colors bg-[var(--bg-secondary)] hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
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
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Invoice Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="input-field"
                    required
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
                  <label className="text-sm font-medium text-[var(--text-secondary)]">WHP Name</label>
                  <input
                    list="whpNameOptions"
                    value={formData.whp_name}
                    onChange={handleWHPChange}
                    className="input-field"
                    placeholder="Enter WHP name"
                  />
                  <datalist id="whpNameOptions">
                    {uniqueWHPs.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Partner</label>
                  <input
                    list="partnerOptions"
                    value={formData.partner}
                    onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
                    className="input-field"
                    placeholder="Select or enter partner"
                  />
                  <datalist id="partnerOptions">
                    {uniquePartners.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Subsidiary</label>
                  <input
                    list="subsidiaryOptions"
                    value={formData.subsidiary}
                    onChange={(e) => setFormData({ ...formData, subsidiary: e.target.value })}
                    className="input-field"
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

              <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-color)] mt-2">
                <label className="text-sm font-medium text-[var(--text-secondary)] flex justify-between">
                  Link Data (Folder)
                  {editingItem && formData.invoice_date && (
                     <div className="flex items-center gap-2">
                       <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button 
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded dark:bg-blue-900/30 dark:text-blue-400 disabled:opacity-50"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          title="Upload new file and update Link Data"
                        >
                          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          {isUploading ? 'Uploading...' : 'Upload File to GDrive'}
                        </button>
                     </div>
                  )}
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
                {editingItem && !formData.invoice_date && (
                   <div className="text-xs text-orange-500 mt-1">Please set Invoice Date to enable file upload</div>
                )}
                {!editingItem && (
                   <div className="text-xs text-[var(--text-muted)] mt-1">File upload will be available after creating this Klaim.</div>
                )}
              </div>
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
                disabled={isSaving || !formData.claim_type || !formData.invoice_date}
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
