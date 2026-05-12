import React, { useState, useMemo, forwardRef, useEffect } from 'react';
import { Search, ExternalLink, ChevronUp, ChevronDown, ListIcon, X, ChevronLeft, ChevronRight, Filter, Paperclip, Loader2, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../apiInterceptor';

export interface DataListWarehouseViewRef {}

interface WarehouseData {
  whp: string;
  name: string;
  location_code: string;
  type_bisnis: string;
  status: string;
  remark: string;
  folder: string;
}

interface DataListWarehouseViewProps {
  dataWarehouse: any[];
  searchQuery: string;
  onClearSearch?: () => void;
  currentUser: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const getPageNumbers = (current: number, total: number) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
};

const DataListWarehouseView = forwardRef<DataListWarehouseViewRef, DataListWarehouseViewProps>(({ dataWarehouse, searchQuery, onClearSearch, currentUser, onRefresh, isRefreshing }, ref) => {
  
  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedWHP, setSelectedWHP] = useState<string[]>([]);

  // Sort
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  // Modal
  const [activeItem, setActiveItem] = useState<WarehouseData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Files
  const [itemFiles, setItemFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // Resizing
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>({
    whp: 150,
    name: 250,
    location_code: 150,
    type_bisnis: 150,
    status: 120,
    remark: 200,
    folder: 100
  });
  const [resizingCol, setResizingCol] = useState<{ key: string, startX: number, startWidth: number } | null>(null);
  const isResizingRef = React.useRef(false);

  const uniqueTypes = useMemo(() => Array.from(new Set(dataWarehouse.map(w => w.type_bisnis).filter(Boolean))).sort(), [dataWarehouse]);
  const uniqueStatus = useMemo(() => Array.from(new Set(dataWarehouse.map(w => w.status).filter(Boolean))).sort(), [dataWarehouse]);
  const uniqueWHP = useMemo(() => Array.from(new Set(dataWarehouse.map(w => w.whp).filter(Boolean))).sort(), [dataWarehouse]);

  const filteredData = useMemo(() => {
    let result = [...dataWarehouse];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.whp?.toLowerCase().includes(q) || false) ||
        (item.name?.toLowerCase().includes(q) || false) ||
        (item.location_code?.toLowerCase().includes(q) || false) ||
        (item.remark?.toLowerCase().includes(q) || false)
      );
    }

    if (selectedTypes.length > 0) result = result.filter(item => selectedTypes.includes(item.type_bisnis || 'None'));
    if (selectedStatus.length > 0) result = result.filter(item => selectedStatus.includes(item.status || 'None'));
    if (selectedWHP.length > 0) result = result.filter(item => selectedWHP.includes(item.whp || 'None'));

    result.sort((a, b) => {
      const valA = (a[sortField] || '').toLowerCase();
      const valB = (b[sortField] || '').toLowerCase();
      const comparison = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result as WarehouseData[];
  }, [dataWarehouse, searchQuery, selectedTypes, selectedStatus, selectedWHP, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  const handleSort = (field: string) => {
    if (isResizingRef.current) return;
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleViewDetails = (item: WarehouseData) => {
    setActiveItem(item);
    setIsModalOpen(true);
    fetchItemFiles(item.folder);
  };
  
  const fetchItemFiles = async (folderUrl: string) => {
    if (!folderUrl) {
      setItemFiles([]);
      return;
    }
    setIsLoadingFiles(true);
    try {
      const folderId = folderUrl.match(/[-\w]{25,}/)?.[0] || folderUrl;
      const res = await apiFetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listWarehouseFiles', folderUrl, folderId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setItemFiles(data.files || []);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !activeItem) return;
    const file = e.target.files[0];
    
    setIsUploading(true);
    try {
      const folderId = activeItem.folder?.match(/[-\w]{25,}/)?.[0] || '';
      
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
      
      const res = await apiFetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadWarehouseFile',
          base64: base64Data,
          fileName: file.name,
          mimeType: file.type,
          whp: activeItem.whp,
          whpName: activeItem.name,
          folderUrl: activeItem.folder,
          folderId: folderId,
          sheetId: '1_rHOUu6u4A_tpP7ScrdgQ6iVmijijB2mCHXTSQ6t1Bg',
          sheetName: 'Cek_status_WH'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          toast.success('File uploaded');
          // Optimistically update file list or requery
          if (activeItem) {
            const newFolderUrl = data.folderUrl || activeItem.folder;
            if (newFolderUrl) {
               fetchItemFiles(newFolderUrl);
               if (!activeItem.folder) {
                 activeItem.folder = newFolderUrl; // Note: mutates local state just for UI
               }
            }
          }
        } else {
          toast.error('Upload failed: ' + data.message);
        }
      } else {
        toast.error('Upload failed: HTTP ' + res.status);
      }
    } catch (e) {
      toast.error('Error reading or uploading file');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // clear input
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    setIsDeletingFile(fileId);
    try {
      const res = await apiFetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteDriveFile', fileId })
      });
      if (res.ok) {
        toast.success("File deleted");
        setItemFiles(prev => prev.filter(f => f.id !== fileId));
        setFileToDelete(null);
      }
    } catch (e) {
      toast.error("Failed to delete file");
    } finally {
      setIsDeletingFile(null);
    }
  };

  // Filter Dropdown Items
  const FilterDropdownItem = ({ title, options, selected, onChange }: { title: string, options: string[], selected: string[], onChange: (val: string) => void }) => {
    return (
      <div className="relative group/sub px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
        <span className="font-medium">{title} {selected.length > 0 && `(${selected.length})`}</span>
        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/sub:text-[var(--text-primary)]" />
        <div className="absolute top-0 left-full ml-1 w-56 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all z-50 max-h-64 overflow-y-auto py-2">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-secondary)] cursor-pointer">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => onChange(opt)} className="rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]" />
              <span className="text-sm text-[var(--text-primary)] truncate">{opt || 'None'}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const activeFiltersCount = selectedTypes.length + selectedStatus.length + selectedWHP.length;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-[var(--bg-body)] h-full overflow-hidden">
      <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Dropdown */}
          <div className="relative group/main z-20">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-primary)] transition-colors">
              <Filter className="w-3.5 h-3.5" />
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </button>
          
            <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/main:opacity-100 group-hover/main:visible transition-all z-40 py-2">
              <FilterDropdownItem title="Status" options={uniqueStatus} selected={selectedStatus} onChange={(val) => setSelectedStatus(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])} />
              <FilterDropdownItem title="Type Bisnis" options={uniqueTypes} selected={selectedTypes} onChange={(val) => setSelectedTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])} />
              <FilterDropdownItem title="WHP" options={uniqueWHP} selected={selectedWHP} onChange={(val) => setSelectedWHP(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])} />
            </div>
          </div>
          
          {(activeFiltersCount > 0 || searchQuery) && (
            <button 
              onClick={() => { 
                setSelectedTypes([]); 
                setSelectedStatus([]); 
                setSelectedWHP([]); 
                setCurrentPage(1);
                onClearSearch?.();
              }} 
              className="px-3 py-1.5 text-xs text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 rounded-md transition-colors font-medium flex items-center justify-center"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-primary)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          )}

          <a
            href="https://docs.google.com/spreadsheets/d/1_rHOUu6u4A_tpP7ScrdgQ6iVmijijB2mCHXTSQ6t1Bg"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-primary)] transition-colors flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Sheet
          </a>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-sm flex flex-col overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <ListIcon className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-secondary)] mb-2">No Warehouse found</h3>
            <p className="text-sm text-[var(--text-muted)]">Check your filters or data source.</p>
          </div>
        ) : (
          <>
          <div className="flex-1 overflow-auto overflow-x-auto min-w-0 pb-10">
            <table className="w-full text-left border-collapse table-fixed select-none">
              <thead className="bg-[var(--bg-surface)] sticky top-0 z-10 shadow-[0_1px_0_var(--border-color)]">
                <tr>
                  {[
                    { key: 'whp', label: 'WHP' },
                    { key: 'name', label: 'WHP Name' },
                    { key: 'location_code', label: 'WH Code' },
                    { key: 'type_bisnis', label: 'Type' },
                    { key: 'status', label: 'Status' },
                    { key: 'remark', label: 'Remark' },
                    { key: 'folder', label: 'Folder' },
                  ].map(({ key, label }, index) => (
                    <th 
                      key={key} 
                      className="px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider relative cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                      style={{ width: colWidths[key] }}
                      onClick={() => handleSort(key)}
                    >
                      <div className="flex items-center gap-2">
                        {label}
                        {sortField === key ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-[var(--accent-color)]" /> : <ChevronDown className="w-3 h-3 text-[var(--accent-color)]" />
                        ) : (
                          <div className="w-3 h-3" />
                        )}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 hover:w-1 bg-transparent hover:bg-[var(--accent-color)] cursor-col-resize z-20 group"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          isResizingRef.current = true;
                          const startWidth = colWidths[key];
                          setResizingCol({ key, startX: e.clientX, startWidth });
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            if (!isResizingRef.current) return;
                            const diff = moveEvent.clientX - e.clientX;
                            setColWidths(prev => ({
                              ...prev,
                              [key]: Math.max(50, startWidth + diff) // Min width 50px
                            }));
                          };
                          
                          const handleMouseUp = () => {
                            setTimeout(() => {
                              isResizingRef.current = false;
                            }, 50);
                            setResizingCol(null);
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                         <div className="absolute inset-y-0 -left-1 -right-1" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {paginatedData.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
                    onClick={() => handleViewDetails(item)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)] truncate" style={{ maxWidth: colWidths.whp }}>{item.whp || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)] truncate" style={{ maxWidth: colWidths.name }}>{item.name || '-'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-[var(--text-secondary)] truncate" style={{ maxWidth: colWidths.location_code }}>{item.location_code || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)] truncate" style={{ maxWidth: colWidths.type_bisnis }}>{item.type_bisnis || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)] truncate" style={{ maxWidth: colWidths.status }}>
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-secondary)] border border-[var(--border-color)] uppercase">
                         {item.status || '-'}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate" style={{ maxWidth: colWidths.remark }}>{item.remark || '-'}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate" style={{ maxWidth: colWidths.folder }}>
                      {item.folder ? (
                         <a 
                           href={item.folder} 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="text-[var(--accent-color)] hover:underline inline-flex items-center gap-1"
                           onClick={(e) => e.stopPropagation()}
                         >
                           <ExternalLink className="w-3.5 h-3.5" /> folder
                         </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredData.length > 0 && (
            <div className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex items-center justify-between shrink-0">
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-[var(--bg-primary)] disabled:opacity-30 transition-colors text-[var(--text-secondary)]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {getPageNumbers(currentPage, totalPages).map((page, index) => (
                    <button
                      key={`${page}-${index}`}
                      disabled={page === '...'}
                      onClick={() => page !== '...' && setCurrentPage(Number(page))}
                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded transition-all ${currentPage === page ? 'bg-[var(--accent-color)] text-[var(--text-on-accent)]' : page === '...' ? 'text-[var(--text-muted)] cursor-default' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary-hover)] cursor-pointer'}`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1 rounded hover:bg-[var(--bg-primary)] disabled:opacity-30 transition-colors text-[var(--text-secondary)]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {isModalOpen && activeItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-200">
          <div className="bg-[var(--bg-surface)] w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
             {/* Header */}
             <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text-primary)] truncate pr-4">Warehouse Detail</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-full transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
             </div>

             {/* Content */}
             <div className="flex-1 overflow-y-auto p-6 text-[var(--text-primary)]">
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div>
                   <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">WHP Name</label>
                   <div className="font-medium text-sm">{activeItem.name || '-'}</div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">WHP Group</label>
                   <div className="font-medium text-sm">{activeItem.whp || '-'}</div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Location Code</label>
                   <div className="font-mono text-sm">{activeItem.location_code || '-'}</div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Type</label>
                   <div className="text-sm">{activeItem.type_bisnis || '-'}</div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Status</label>
                   <div className="text-sm">{activeItem.status || '-'}</div>
                 </div>
                 <div className="col-span-2">
                   <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Remark</label>
                   <div className="text-sm pl-2 border-l-2 border-[var(--border-color)]">{activeItem.remark || 'No remark'}</div>
                 </div>
               </div>

               {/* Attachments Section */}
               <div className="border-t border-[var(--border-color)] pt-6 mt-4">
                 <div className="flex items-center justify-between mb-4">
                   <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                     <Paperclip className="w-4 h-4" /> Files / Attachments
                   </h4>
                   <div className="flex items-center gap-2">
                     <input type="file" id="wh-upload" className="hidden" onChange={handleFileUpload} />
                     <label htmlFor="wh-upload" className="cursor-pointer px-3 py-1.5 bg-[var(--accent-color)] text-white text-xs font-bold rounded shadow-sm hover:bg-opacity-90 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                       {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                       Upload File
                     </label>
                     {activeItem.folder && (
                       <a href={activeItem.folder} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] text-xs font-bold rounded shadow-sm hover:bg-[var(--bg-primary)] transition-colors flex items-center gap-1.5">
                         <ExternalLink className="w-3.5 h-3.5" /> Drive
                       </a>
                     )}
                   </div>
                 </div>

                 {isLoadingFiles ? (
                   <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent-color)]" /></div>
                 ) : itemFiles.length === 0 ? (
                   <p className="text-xs text-[var(--text-muted)] italic text-center p-4 bg-[var(--bg-secondary)] rounded border border-[var(--border-color)]">No files attached.</p>
                 ) : (
                   <div className="space-y-2">
                     {itemFiles.map(file => (
                       <div key={file.id} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg group">
                         <div className="flex items-center gap-3 overflow-hidden">
                           <Paperclip className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                           <div className="flex flex-col overflow-hidden">
                             <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--accent-color)] hover:underline truncate">
                               {file.name}
                             </a>
                             <span className="text-[10px] text-[var(--text-muted)] mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.dateCreated).toLocaleDateString()}</span>
                           </div>
                         </div>
                         <div className="flex items-center gap-1">
                           {fileToDelete === file.id ? (
                             <div className="flex items-center gap-1 bg-[var(--badge-danger-bg)] rounded-md p-0.5 border border-[var(--danger-color)] border-opacity-30">
                               <button 
                                 type="button"
                                 onClick={(e) => {
                                   e.preventDefault();
                                   e.stopPropagation();
                                   handleDeleteFile(file.id);
                                 }}
                                 disabled={isDeletingFile === file.id}
                                 className="text-[var(--danger-color)] hover:bg-[var(--danger-color)] hover:text-white text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                               >
                                 {isDeletingFile === file.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                 Yes
                               </button>
                               <button 
                                 type="button"
                                 onClick={(e) => {
                                   e.preventDefault();
                                   e.stopPropagation();
                                   setFileToDelete(null);
                                 }}
                                 disabled={isDeletingFile === file.id}
                                 className="text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50"
                               >
                                 No
                               </button>
                             </div>
                           ) : (
                             <button
                               onClick={() => setFileToDelete(file.id)}
                               disabled={isDeletingFile === file.id}
                               className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-primary)] rounded transition-colors"
                             >
                               {isDeletingFile === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                             </button>
                           )}
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
});

DataListWarehouseView.displayName = 'DataListWarehouseView';

export default DataListWarehouseView;
