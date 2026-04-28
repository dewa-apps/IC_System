import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, formatDoc } from './apiInterceptor';
import { auth, db } from './firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { 
  Layout, 
  CheckSquare,
  Plus, 
  Search, 
  MoreHorizontal, 
  User, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  X,
  Trash2,
  MessageSquare,
  Send,
  GripVertical,
  ArrowUpAZ,
  CalendarDays,
  Tag,
  Hash,
  Edit2,
  Paperclip,
  Download,
  Upload,
  FileText,
  List as ListIcon,
  Menu,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  BarChart3,
  Layers,
  Filter,
  Sun,
  Moon,
  History,
  Lock,
  Bell,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskStatus, TaskPriority, Comment, Attachment, SubTask, Template, ActivityLog, TaskLink, LinkType, User as AppUser, DataListLink } from './types';
import DataListLinkView, { DataListLinkViewRef } from './components/DataListLinkView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import AuditLogView from './components/AuditLogView';
import RichTextEditor from './components/RichTextEditor';
import GanttView from './components/GanttView';
import Papa from 'papaparse';

// Helper to strip HTML tags for line-clamp preview
const stripHtml = (html: string) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const STATUS_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'TODO', label: 'To Do' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'REVIEW', label: 'In Review' },
  { id: 'DONE', label: 'Done' },
  { id: 'CLOSED', label: 'Closed' }
];

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const PRIORITY_WEIGHT = {
  'URGENT': 4,
  'HIGH': 3,
  'MEDIUM': 2,
  'LOW': 1
};

type SortCriteria = 'DUE_DATE' | 'PRIORITY' | 'CATEGORY' | 'NEWEST_ID';

const getAvatarColor = (name: string) => {
  const colors = [
    { bg: '#FF5630', text: '#FFFFFF' }, // Red
    { bg: '#FFAB00', text: '#172B4D' }, // Yellow
    { bg: '#36B37E', text: '#FFFFFF' }, // Green
    { bg: '#00B8D9', text: '#FFFFFF' }, // Sky
    { bg: '#0052CC', text: '#FFFFFF' }, // Blue
    { bg: '#6554C0', text: '#FFFFFF' }, // Purple
    { bg: '#FF7452', text: '#FFFFFF' }, // Orange
    { bg: '#2684FF', text: '#FFFFFF' }, // Light Blue
    { bg: '#57D9A3', text: '#172B4D' }, // Light Green
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Logo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <rect width="24" height="24" rx="4" fill="currentColor" />
    <text 
      x="50%" 
      y="50%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fill="white" 
      fontSize="10" 
      fontWeight="bold" 
      fontFamily="sans-serif"
    >
      IC
    </text>
  </svg>
);

interface SortableTaskProps {
  task: Task;
  onClick: (task?: Task) => void;
  getPriorityIcon: (priority: TaskPriority) => React.ReactNode;
  key?: React.Key;
}

function SortableTask({ task, onClick, getPriorityIcon }: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = task.due_date && 
    new Date(task.due_date).setHours(23, 59, 59, 999) < new Date().getTime() && 
    task.status !== 'DONE' && 
    task.status !== 'CLOSED';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card group relative border ${
        isOverdue 
          ? 'border-[var(--danger-color)] bg-[var(--badge-danger-bg)] hover:border-[var(--danger-color)]' 
          : 'hover:border-[var(--accent-color)]'
      }`}
      onClick={() => onClick(task)}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 hover:bg-[var(--bg-secondary)] rounded transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-[var(--text-muted)]" />
      </div>
      
      <p className="text-sm text-[var(--text-primary)] mb-1 leading-tight font-medium pr-6">
        {task.title}
      </p>
      {task.description && (
        <p 
          className="text-[11px] text-[var(--text-muted)] mb-3 line-clamp-2 leading-normal"
          title={stripHtml(task.description)}
        >
          {stripHtml(task.description)}
        </p>
      )}

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-[var(--text-muted)]" />
              <span className="text-[10px] font-medium text-[var(--text-muted)]">
                {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
              </span>
            </div>
            <span className="text-[10px] font-medium text-[var(--text-muted)]">
              {Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[var(--accent-color)] transition-all duration-300"
              style={{ width: `${(task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1 mb-3">
        {task.category && (
          <span className="text-[10px] px-1.5 py-0.5 badge-accent rounded font-medium">
            {task.category}
          </span>
        )}
        {task.brand && (
          <span className="text-[10px] px-1.5 py-0.5 badge-purple rounded font-medium">
            {task.brand}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getPriorityIcon(task.priority)}
          <span className="text-[10px] font-bold text-[var(--text-muted)]">{task.display_id || `IC-${task.id}`}</span>
        </div>
        <div className="flex items-center gap-3">
          {(task.comment_count !== undefined && task.comment_count > 0 || task.attachment_count !== undefined && task.attachment_count > 0) && (
            <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-muted)]">
              {task.comment_count !== undefined && task.comment_count > 0 && (
                <div className="flex items-center gap-1" title="Comments">
                  <MessageSquare className="w-3 h-3" />
                  {task.comment_count}
                </div>
              )}
              {task.attachment_count !== undefined && task.attachment_count > 0 && (
                <div className="flex items-center gap-1" title="Attachments">
                  <Paperclip className="w-3 h-3" />
                  {task.attachment_count}
                </div>
              )}
            </div>
          )}
          {task.due_date && (
            <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-[var(--danger-color)]' : 'text-[var(--text-muted)]'}`}>
              <Clock className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })}
            </div>
          )}
          <div className="flex items-center -space-x-1">
            {task.authorName && (
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm border border-[var(--bg-surface)] z-10" 
                title={`Created by: ${task.authorName}`}
                style={{ 
                  backgroundColor: getAvatarColor(task.authorName).bg,
                  color: getAvatarColor(task.authorName).text
                }}
              >
                {getInitials(task.authorName)}
              </div>
            )}
            {(() => {
              const assignees = Array.from(new Set([
                task.assignee, 
                ...(task.subtasks?.map(st => st.assignee || task.assignee) || [])
              ])).filter(Boolean) as string[];

              if (assignees.length === 0) return null;

              if (assignees.length === 1) {
                return (
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm border border-[var(--bg-surface)] z-20" 
                    title={`Assignee: ${assignees[0]}`}
                    style={{ 
                      backgroundColor: getAvatarColor(assignees[0]).bg,
                      color: getAvatarColor(assignees[0]).text
                    }}
                  >
                    {getInitials(assignees[0])}
                  </div>
                );
              }

              return (
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm border border-[var(--bg-surface)] z-20 bg-[var(--bg-secondary)] text-[var(--accent-color)]" 
                  title={`Assignees: ${assignees.join(', ')}`}
                >
                  +{assignees.length}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  id: TaskStatus;
  label: string;
  tasks: Task[];
  onAddTask: (status: TaskStatus) => void;
  onTaskClick: (task?: Task) => void;
  getPriorityIcon: (priority: TaskPriority) => React.ReactNode;
  onRenameColumn: (id: TaskStatus, newLabel: string) => void;
  onSortTasks: (id: TaskStatus, criteria: SortCriteria) => void;
  currentUserRole?: string;
  key?: React.Key;
}

function KanbanColumn({ id, label, tasks, onAddTask, onTaskClick, getPriorityIcon, onRenameColumn, onSortTasks, currentUserRole }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newLabel, setNewLabel] = useState(label);
  const [displayLimit, setDisplayLimit] = useState(20);

  const handleRename = () => {
    if (newLabel.trim() && newLabel !== label) {
      onRenameColumn(id, newLabel.trim());
    }
    setIsRenaming(false);
    setIsMenuOpen(false);
  };

  const visibleTasks = tasks.slice(0, displayLimit);
  const hasMore = tasks.length > displayLimit;

  return (
    <div className="w-80 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-1 relative shrink-0">
        {isRenaming ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider bg-[var(--bg-surface)] border border-[var(--accent-color)] rounded px-1 py-0.5 w-full outline-none"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
        ) : (
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            {label} 
            <span className="bg-[var(--border-color)] px-2 py-0.5 rounded-full text-[10px] text-[var(--text-secondary)]">{tasks.length}</span>
          </h2>
        )}
        
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-1 rounded transition-colors ${isMenuOpen ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-[var(--bg-surface)] rounded-md shadow-xl border border-[var(--border-color)] z-30 py-1 overflow-hidden">
                {currentUserRole === 'admin' && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-color)] mb-1">
                      Column Actions
                    </div>
                    <button 
                      onClick={() => {
                        setIsRenaming(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      Rename Column
                    </button>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider border-y border-[var(--border-color)] my-1">
                      Sort Tasks By
                    </div>
                  </>
                )}
                {currentUserRole !== 'admin' && (
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-color)] mb-1">
                    Sort Tasks By
                  </div>
                )}
                <button 
                  onClick={() => { onSortTasks(id, 'DUE_DATE'); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Due Date
                </button>
                <button 
                  onClick={() => { onSortTasks(id, 'PRIORITY'); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Priority
                </button>
                <button 
                  onClick={() => { onSortTasks(id, 'CATEGORY'); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                >
                  <Tag className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Category
                </button>
                <button 
                  onClick={() => { onSortTasks(id, 'NEWEST_ID'); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                >
                  <Hash className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Newest ID
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`kanban-column flex-1 overflow-y-auto pr-2 pb-2 transition-colors scrollbar-thin scrollbar-thumb-theme ${isOver ? 'bg-[var(--bg-secondary-hover)]' : ''}`}
      >
        <SortableContext 
          id={id}
          items={visibleTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {visibleTasks.map(task => (
                <SortableTask 
                  key={task.id} 
                  task={task} 
                  onClick={onTaskClick} 
                  getPriorityIcon={getPriorityIcon} 
                />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
        
        {hasMore && (
          <button 
            onClick={() => setDisplayLimit(prev => prev + 20)}
            className="w-full py-2 mt-2 text-xs font-bold text-[var(--accent-color)] hover:bg-[var(--badge-accent-bg)] rounded border border-dashed border-[var(--accent-color)] border-opacity-30 transition-colors"
          >
            Show {Math.min(20, tasks.length - displayLimit)} more... ({tasks.length - displayLimit} remaining)
          </button>
        )}
        
        <button 
          onClick={() => onAddTask(id)}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] p-2 rounded transition-colors mt-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create issue
        </button>
      </div>
    </div>
  );
}

const getStatusClasses = (status: string) => {
  switch (status) {
    case 'TODO': return 'badge-neutral';
    case 'IN_PROGRESS': return 'badge-accent';
    case 'REVIEW': return 'badge-warning';
    case 'DONE': return 'badge-success';
    case 'CLOSED': return 'badge-purple';
    default: return 'badge-neutral';
  }
};

const getPageNumbers = (current: number, total: number) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
};

interface TaskListViewProps {
  tasks: Task[];
  users: AppUser[];
  onTaskClick: (task: Task) => void;
  onInlineUpdate: (taskId: string, field: string, value: any) => void;
  getPriorityIcon: (priority: TaskPriority) => React.ReactNode;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

function TaskListView({ 
  tasks, 
  users,
  onTaskClick, 
  onInlineUpdate,
  getPriorityIcon,
  currentPage,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  sortField,
  sortOrder,
  onSort
}: TaskListViewProps) {
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpAZ className="w-3 h-3 opacity-20" />;
    return sortOrder === 'asc' ? <ArrowUpAZ className="w-3 h-3" /> : <ArrowUpAZ className="w-3 h-3 rotate-180" />;
  };

  const [colWidths, setColWidths] = React.useState<{ [key: string]: number }>({
    id: 120,
    title: 400,
    status: 150,
    priority: 150,
    assignee: 150,
    author: 150,
    due_date: 150
  });

  const [resizingCol, setResizingCol] = React.useState<{ key: string, startX: number, startWidth: number } | null>(null);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCol) return;
      const displayDx = e.clientX - resizingCol.startX;
      setColWidths(prev => ({
        ...prev,
        [resizingCol.key]: Math.max(50, resizingCol.startWidth + displayDx)
      }));
    };
    const handleMouseUp = () => {
      setResizingCol(null);
    };
    if (resizingCol) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  const handleResizeStart = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol({ key, startX: e.clientX, startWidth: colWidths[key] || 100 });
  };

  const ResizeHandle = ({ columnKey }: { columnKey: string }) => (
    <div 
      className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-color)] ${resizingCol?.key === columnKey ? 'bg-[var(--accent-color)] opacity-100' : 'group-hover:bg-[var(--border-color)] opacity-0 group-hover:opacity-100'} transition-colors z-10`}
      onMouseDown={(e) => handleResizeStart(e, columnKey)}
      onClick={(e) => e.stopPropagation()}
    />
  );

  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg overflow-hidden shadow-sm flex flex-col h-full transition-colors duration-200 ${resizingCol ? 'select-none' : ''}`}>
      <div className="overflow-auto flex-1">
        <table className="w-max min-w-full text-left border-collapse whitespace-nowrap relative table-fixed" style={{ width: Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] shadow-sm">
              <th 
                className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                onClick={() => onSort('id')}
                style={{ width: colWidths.id }}
              >
                <div className="flex items-center gap-1 overflow-hidden">
                  Key <SortIcon field="id" />
                </div>
                <ResizeHandle columnKey="id" />
              </th>
              <th 
                className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                onClick={() => onSort('title')}
                style={{ width: colWidths.title }}
              >
                <div className="flex items-center gap-1 overflow-hidden">
                  Summary <SortIcon field="title" />
                </div>
                <ResizeHandle columnKey="title" />
              </th>
              <th 
                className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                onClick={() => onSort('status')}
                style={{ width: colWidths.status }}
              >
                <div className="flex items-center gap-1 overflow-hidden">
                  Status <SortIcon field="status" />
                </div>
                <ResizeHandle columnKey="status" />
              </th>
              <th 
                className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                onClick={() => onSort('priority')}
                style={{ width: colWidths.priority }}
              >
                <div className="flex items-center gap-1 overflow-hidden">
                  Priority <SortIcon field="priority" />
                </div>
                <ResizeHandle columnKey="priority" />
              </th>
              <th className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider relative group" style={{ width: colWidths.assignee }}>
                <div className="overflow-hidden">Assignee</div>
                <ResizeHandle columnKey="assignee" />
              </th>
              <th className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider relative group" style={{ width: colWidths.author }}>
                <div className="overflow-hidden">Created By</div>
                <ResizeHandle columnKey="author" />
              </th>
              <th 
                className="px-4 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-secondary)] relative group"
                onClick={() => onSort('due_date')}
                style={{ width: colWidths.due_date }}
              >
                <div className="flex items-center gap-1 overflow-hidden">
                  Due Date <SortIcon field="due_date" />
                </div>
                <ResizeHandle columnKey="due_date" />
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const isOverdue = task.due_date && 
                new Date(task.due_date).setHours(23, 59, 59, 999) < new Date().getTime() && 
                task.status !== 'DONE' && 
                task.status !== 'CLOSED';

              return (
                <tr 
                  key={task.id} 
                  className={`border-b border-[var(--border-color)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors ${isOverdue ? 'bg-[var(--badge-danger-bg)]' : ''}`}
                  onClick={() => onTaskClick(task)}
                >
                  <td className="px-4 py-3 text-xs font-bold text-[var(--accent-color)] hover:underline truncate max-w-0">{task.display_id || `IC-${task.id}`}</td>
                  <td className="px-4 py-3 truncate max-w-0">
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">{task.title}</span>
                      {task.category && (
                        <span className="text-[10px] text-[var(--badge-accent-text)] font-medium truncate">{task.category}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 truncate max-w-0" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={task.status}
                      onChange={(e) => onInlineUpdate(String(task.id), 'status', e.target.value)}
                      className={`text-[10px] px-2 py-1 rounded font-bold uppercase whitespace-nowrap outline-none cursor-pointer border border-transparent hover:border-[var(--border-focus)] transition-colors appearance-none ${getStatusClasses(task.status)} max-w-full text-ellipsis overflow-hidden`}
                    >
                      <option value="TODO">TODO</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="REVIEW">REVIEW</option>
                      <option value="DONE">DONE</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 truncate max-w-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="shrink-0">{getPriorityIcon(task.priority)}</div>
                      <select
                        value={task.priority}
                        onChange={(e) => onInlineUpdate(String(task.id), 'priority', e.target.value)}
                        className="text-xs text-[var(--text-secondary)] bg-transparent outline-none cursor-pointer hover:bg-[var(--bg-secondary)] rounded px-1 py-0.5 border border-transparent hover:border-[var(--border-focus)] transition-colors appearance-none truncate"
                      >
                        <option value="URGENT">URGENT</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 truncate max-w-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const assignees = Array.from(new Set([
                          task.assignee, 
                          ...(task.subtasks?.map(st => st.assignee || task.assignee) || [])
                        ])).filter(Boolean) as string[];

                        if (assignees.length === 0) {
                          return (
                            <div className="w-6 h-6 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center shrink-0">
                              <User className="w-3 h-3 text-[var(--text-muted)]" />
                            </div>
                          );
                        }

                        if (assignees.length === 1) {
                          return (
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ 
                                backgroundColor: getAvatarColor(assignees[0]).bg,
                                color: getAvatarColor(assignees[0]).text
                              }}
                            >
                              {getInitials(assignees[0])}
                            </div>
                          );
                        }

                        return (
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)]" 
                            title={`Assignees: ${assignees.join(', ')}`}
                          >
                            +{assignees.length}
                          </div>
                        );
                      })()}
                      <select
                        value={task.assignee || ''}
                        onChange={(e) => onInlineUpdate(String(task.id), 'assignee', e.target.value || null)}
                        className={`text-xs bg-transparent outline-none cursor-pointer hover:bg-[var(--bg-secondary)] rounded px-1 py-0.5 border border-transparent hover:border-[var(--border-focus)] transition-colors appearance-none truncate max-w-full ${!task.assignee ? 'text-[var(--text-muted)] italic' : 'text-[var(--text-secondary)]'}`}
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 truncate max-w-0" onClick={(e) => e.stopPropagation()}>
                    {task.authorName ? (
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ 
                            backgroundColor: getAvatarColor(task.authorName).bg,
                            color: getAvatarColor(task.authorName).text
                          }}
                        >
                          {getInitials(task.authorName)}
                        </div>
                        <span className="text-xs text-[var(--text-secondary)] truncate">{task.authorName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)] italic">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 truncate max-w-0" onClick={(e) => e.stopPropagation()}>
                    {task.due_date ? (
                      <div className={`flex items-center gap-1 text-xs truncate max-w-full overflow-hidden ${isOverdue ? 'text-[var(--danger-color)] font-bold' : 'text-[var(--text-secondary)]'}`}>
                        {isOverdue && <Clock className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {tasks.length === 0 ? (
        <div className="p-12 text-center text-[var(--text-muted)] italic bg-[var(--bg-surface)]">
          No tasks found matching your criteria.
        </div>
      ) : (
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
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  visible: boolean;
  onClick?: () => void;
  subItems?: { label: string; active: boolean; onClick: () => void }[];
}

function SidebarItem({ icon, label, active, collapsed, visible, onClick, subItems }: SidebarItemProps) {
  const hasSubItems = subItems && subItems.length > 0;
  const isAnySubActive = subItems?.some(sub => sub.active);
  const [isOpen, setIsOpen] = useState(isAnySubActive || false);

  const handleClick = () => {
    if (hasSubItems) {
      setIsOpen(!isOpen);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className="w-full relative group/sidebarItem">
      <button
        onClick={handleClick}
        className={`w-full flex items-center justify-between p-2.5 rounded-md transition-all ${
          active || isAnySubActive
            ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar)] font-medium' 
            : 'text-[var(--text-sidebar-muted)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0">{icon}</div>
          {!collapsed && <span className="text-sm truncate">{label}</span>}
        </div>
        {!collapsed && hasSubItems && (
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Flyout or Tooltip for collapsed state */}
      {collapsed && visible && (
        <div 
          className={`fixed left-16 ml-2 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md shadow-xl opacity-0 invisible group-hover/sidebarItem:opacity-100 group-hover/sidebarItem:visible transition-all z-[1000] overflow-hidden ${
            hasSubItems ? 'w-48 py-1 pointer-events-auto' : 'px-2 py-1 pointer-events-none'
          }`}
          style={{ marginTop: '-36px' }} 
        >
          {hasSubItems ? (
            <>
              <div className="px-3 py-2 text-xs font-bold text-[var(--text-sidebar-muted)] border-b border-[var(--border-color)] uppercase tracking-wider mb-1">
                {label}
              </div>
              <div className="flex flex-col">
                {subItems.map((sub, i) => (
                  <button
                    key={i}
                    onClick={sub.onClick}
                    className={`w-full text-left px-3 py-2 text-sm transition-all ${
                      sub.active
                        ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar)] font-medium'
                        : 'text-[var(--text-sidebar-muted)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar)]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <span className="text-xs text-[var(--text-sidebar)] whitespace-nowrap">{label}</span>
          )}
        </div>
      )}
      
      {!collapsed && hasSubItems && isOpen && (
        <div className="mt-1 ml-9 space-y-1">
          {subItems.map((sub, i) => (
            <button
              key={i}
              onClick={sub.onClick}
              className={`w-full flex items-center p-2 text-sm rounded-md transition-all ${
                sub.active
                  ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar)] font-medium'
                  : 'text-[var(--text-sidebar-muted)] hover:text-[var(--text-sidebar)]'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const currentUser = auth.currentUser;
  const currentUserName = currentUser?.displayName || currentUser?.email || 'Unknown User';
  const currentUserPhoto = currentUser?.photoURL;

  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'user'>('user');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [systemLogs, setSystemLogs] = useState<ActivityLog[]>([]);
  const [taskLimit, setTaskLimit] = useState(50);
  const [hasMoreTasks, setHasMoreTasks] = useState(true);
  const [columns, setColumns] = useState<{ id: TaskStatus; label: string }[]>([
    { id: 'TODO', label: 'To Do' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'REVIEW', label: 'In Review' },
    { id: 'DONE', label: 'Done' },
    { id: 'CLOSED', label: 'Closed' }
  ]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | number | ''>('');
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [showTemplateDeleteConfirm, setShowTemplateDeleteConfirm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | string | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | number | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [dataLinks, setDataLinks] = useState<DataListLink[]>([]);
  const [metadataOptions, setMetadataOptions] = useState({
    categories: [] as string[],
    brands: [] as string[],
    requestors: [] as string[],
    divisions: [] as string[],
    category_link: [] as string[]
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState<string | number | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isDeletingTaskInProgress, setIsDeletingTaskInProgress] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([]);
  const [isLinkingTask, setIsLinkingTask] = useState(false);
  const [isRemovingLink, setIsRemovingLink] = useState<number | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>('relates_to');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<string>('tasks');
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'gantt'>('board');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
      return 'system';
    }
    return 'system';
  });

  const [notificationConfig, setNotificationConfig] = useState({
    email: localStorage.getItem('notify_email') !== 'false', // default true
    inApp: localStorage.getItem('notify_in_app') !== 'false' // default true
  });

  const [backupConfig, setBackupConfig] = useState<{enabled: boolean, intervalMinutes: number}>({ 
    enabled: false, 
    intervalMinutes: 15 
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const updateNotificationConfig = (key: 'email' | 'inApp', value: boolean) => {
    setNotificationConfig(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem(key === 'email' ? 'notify_email' : 'notify_in_app', String(value));
      return updated;
    });
  };

  // Pagination, Sort, Filter states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Calculate filtered tasks here to be used in views and exports
  const uniqueAssignees = Array.from(new Set(tasks.flatMap(t => {
    const list = [t.assignee];
    if (t.subtasks) {
      t.subtasks.forEach(st => list.push(st.assignee || t.assignee));
    }
    return list;
  }).filter(Boolean))) as string[];
  const hasUnassignedTasks = tasks.some(t => !t.assignee || (t.subtasks && t.subtasks.some(st => !st.assignee && !t.assignee)));
  const uniqueCategories = metadataOptions.categories;
  const uniqueBrands = metadataOptions.brands;
  const uniqueRequestors = metadataOptions.requestors;
  const uniqueDivisions = metadataOptions.divisions;

  const filteredTasks = tasks.filter(t => {
    const taskKey = t.display_id || `IC-${t.id}`;
    const matchesSearch = taskKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.requestor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const taskAssignees = Array.from(new Set([
      t.assignee, 
      ...(t.subtasks?.map(st => st.assignee || t.assignee) || [])
    ]));
    
    const matchesAssignee = selectedAssignees.length === 0 || 
      taskAssignees.some(a => (a && selectedAssignees.includes(a)) || (!a && selectedAssignees.includes('Unassigned')));
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(t.status);
    const matchesPriority = selectedPriorities.length === 0 || selectedPriorities.includes(t.priority);
    const matchesCategory = selectedCategories.length === 0 || (t.category && selectedCategories.includes(t.category));
    const matchesBrand = selectedBrands.length === 0 || (t.brand && selectedBrands.includes(t.brand));
    
    return matchesSearch && matchesAssignee && matchesStatus && matchesPriority && matchesCategory && matchesBrand;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortField === 'id') {
      comparison = Number(a.id) - Number(b.id);
    } else if (sortField === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (sortField === 'dueDate') {
      if (!a.due_date) return sortOrder === 'asc' ? 1 : -1;
      if (!b.due_date) return sortOrder === 'asc' ? -1 : 1;
      comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    } else if (sortField === 'priority') {
      comparison = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleExportData = () => {
    const headers = ['Task ID', 'Title', 'Description', 'Status', 'Priority', 'Assignee', 'Category', 'Brand', 'Requestor', 'Division', 'Request Date', 'Due Date', 'Created At'];
    
    const rows = filteredTasks.map(task => {
      return [
        task.display_id || `IC-${task.id}`,
        `"${task.title.replace(/"/g, '""')}"`,
        `"${stripHtml(task.description || '').replace(/"/g, '""')}"`,
        task.status,
        task.priority,
        task.assignee || 'Unassigned',
        task.category || '',
        task.brand || '',
        task.requestor || '',
        task.division || '',
        task.request_date || '',
        task.due_date || '',
        task.created_at ? new Date(task.created_at).toISOString().split('T')[0] : ''
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tasks_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const imports = results.data.map((row: any) => {
            // Format Dates appropriately if they are in D/M/YYYY or similar format
            const formatDate = (dateStr: string) => {
              if (!dateStr) return '';
              try {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  // Assuming MM/DD/YYYY or M/D/YYYY
                  const dt = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T00:00:00Z`);
                  if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
                }
                const dt = new Date(dateStr);
                if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
              } catch (e) {
                return '';
              }
              return '';
            }

            const rawStatus = (row.Status || '').trim().toUpperCase();
            const rawPriority = (row.Priority || '').trim().toUpperCase();

            const taskData: any = {
              title: row.Title || 'Imported Task',
              description: row.Description || '',
              status: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CLOSED'].includes(rawStatus) ? rawStatus : 'TODO',
              priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(rawPriority) ? rawPriority : 'MEDIUM',
              assignee: row.Assignee === 'Unassigned' ? '' : row.Assignee || '',
              category: row.Category || '',
              brand: row.Brand || '',
              requestor: row.Requestor || '',
              division: row.Division || '',
              request_date: formatDate(row['Request Date']) || getJakartaToday(),
              due_date: formatDate(row['Due Date']) || '',
            };

            // Parse optional advanced fields overrides securely
            if (row['Task ID'] || row['display_id']) taskData.display_id = row['Task ID'] || row['display_id'];
            if (row['Created By'] || row['authorName']) taskData.authorName = row['Created By'] || row['authorName'];
            if (row['authorId']) taskData.authorId = row['authorId'];
            if (row['task_number']) taskData.task_number = parseInt(row['task_number'], 10);
            if (row['Created At'] || row['created_at']) taskData.created_at = row['Created At'] || row['created_at'];

            return taskData;
          });

          let successCount = 0;
          for (const taskData of imports) {
            // Find existing task by display_id or ID
            const existingTask = tasks.find((t: any) => 
               (taskData.display_id && t.display_id === taskData.display_id) || 
               (taskData.display_id && `IC-${t.id}` === taskData.display_id)
            );

            if (existingTask) {
              // Update/overwrite existing task
              const res = await apiFetch(`/api/tasks/${existingTask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
              });
              if (res.ok) successCount++;
            } else {
              // Create new task
              const res = await apiFetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
              });
              if (res.ok) successCount++;
            }
          }
          
          if (successCount === imports.length) {
            toast.success(`Successfully imported ${successCount} tasks`);
          } else {
            toast.success(`Imported ${successCount} out of ${imports.length} tasks`);
          }
          fetchTasks(); // Refresh list
        } catch (error) {
          console.error("Import error:", error);
          toast.error("An error occurred during import.");
        }
      }
    });
    
    // reset input
    if (importInputRef.current) {
        importInputRef.current.value = '';
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dataListLinkRef = React.useRef<DataListLinkViewRef>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getJakartaToday = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  };

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO' as TaskStatus,
    priority: 'MEDIUM' as TaskPriority,
    assignee: '',
    request_date: getJakartaToday(),
    due_date: '',
    category: '',
    brand: '',
    requestor: '',
    division: '',
    subtasks: [] as SubTask[],
    recurring_pattern: 'none' as 'none' | 'daily' | 'weekly' | 'monthly'
  });

  const getUpdatedStatus = (subtasks: SubTask[], currentStatus: TaskStatus): TaskStatus => {
    if (!subtasks || subtasks.length === 0) return currentStatus;
    
    const allCompleted = subtasks.every(st => st.completed);
    const anyCompleted = subtasks.some(st => st.completed);
    
    if (allCompleted) return 'REVIEW';
    if (anyCompleted) return 'IN_PROGRESS';
    
    if (currentStatus === 'DONE' || currentStatus === 'IN_PROGRESS' || currentStatus === 'REVIEW') {
      return 'TODO';
    }
    
    return currentStatus;
  };

  const addSubTask = () => {
    const newSubTask: SubTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      completed: false,
      due_date: ''
      // Inherits parent assignee by leaving this undefined
    };
    setFormData(prev => {
      const newSubtasks = [...(prev.subtasks || []), newSubTask];
      return {
        ...prev,
        subtasks: newSubtasks,
        status: getUpdatedStatus(newSubtasks, prev.status)
      };
    });
  };

  const toggleSubTask = (id: string) => {
    setFormData(prev => {
      const newSubtasks = prev.subtasks?.map(st => 
        st.id === id ? { ...st, completed: !st.completed } : st
      ) || [];
      return {
        ...prev,
        subtasks: newSubtasks,
        status: getUpdatedStatus(newSubtasks, prev.status)
      };
    });
  };

  const updateSubTaskTitle = (id: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks?.map(st => 
        st.id === id ? { ...st, title } : st
      )
    }));
  };

  const updateSubTaskDueDate = (id: string, due_date: string) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks?.map(st => 
        st.id === id ? { ...st, due_date } : st
      )
    }));
  };

  const updateSubTaskAssignee = (id: string, assignee: string) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks?.map(st => 
        st.id === id ? { ...st, assignee } : st
      )
    }));
  };

  const deleteSubTask = (id: string) => {
    setFormData(prev => {
      const newSubtasks = prev.subtasks?.filter(st => st.id !== id) || [];
      return {
        ...prev,
        subtasks: newSubtasks,
        status: getUpdatedStatus(newSubtasks, prev.status)
      };
    });
  };

  useEffect(() => {
    fetchUsers();
    fetchTasks();
    fetchTemplates();
    fetchMetadataOptions();
  }, [currentUser]);

  const myNameInDb = users.find(u => u.email === currentUser?.email)?.name || currentUserName;

  useEffect(() => {
    if (!currentUser) return;
    
    // Subscribe to system activity logs (limit to 100 for global audit)
    const q = query(collection(db, 'activity_log'), orderBy('created_at', 'desc'), limit(100));
    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(formatDoc) as ActivityLog[];
      setSystemLogs(logs);
    }, (err) => console.error("Global activity log listener error:", err));
    
    // Subscribe to metadata settings
    const unsubscribeMeta = onSnapshot(doc(db, 'metadata', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.backup) {
          setBackupConfig(data.backup);
        }
      }
    });

    return () => {
      unsubscribeLogs();
      unsubscribeMeta();
    };
  }, [currentUser]);

  const updateBackupConfig = async (config: { enabled: boolean; intervalMinutes: number }) => {
    try {
      await setDoc(doc(db, 'metadata', 'settings'), { backup: config }, { merge: true });
      setBackupConfig(config);
      toast.success('Backup settings updated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update backup settings');
    }
  };

  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const dataLinksRef = useRef(dataLinks);
  useEffect(() => {
    dataLinksRef.current = dataLinks;
  }, [dataLinks]);

  useEffect(() => {
    if (!backupConfig.enabled || currentUserRole !== 'admin') return;

    const intervalMs = backupConfig.intervalMinutes * 60 * 1000;
    const intervalId = setInterval(async () => {
       try {
         console.log('Running automatic backup...');
         await apiFetch('/api/backup-to-sheets', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             sheetId: '1NbsPeG4LH4i6-VdmA3qCgBGxivKXTEuAvfh6VnzGrh0',
             tasks: tasksRef.current
           })
         });
         
         await apiFetch('/api/backup-links-to-sheets', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             sheetId: '1NbsPeG4LH4i6-VdmA3qCgBGxivKXTEuAvfh6VnzGrh0',
             sheetName: 'LINK',
             links: dataLinksRef.current
           })
         });
       } catch (err) {
         console.error('Auto backup failed', err);
       }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [backupConfig.enabled, backupConfig.intervalMinutes, currentUserRole]);

  useEffect(() => {
    // Subscribe to notifications
    if (myNameInDb) {
      const q = query(
        collection(db, 'notifications'), 
        where('recipient', '==', myNameInDb),
        orderBy('created_at', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setNotifications(notifs);
      }, (error) => {
        console.error("Error fetching notifications:", error);
      });
      return () => unsubscribe();
    }
  }, [myNameInDb]);

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  };

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    // SQLite CURRENT_TIMESTAMP is YYYY-MM-DD HH:MM:SS (UTC)
    // Append Z if it's a date-time string without timezone to treat as UTC
    const normalized = dateStr.includes(' ') ? dateStr.replace(' ', 'T') + 'Z' : 
                      (dateStr.includes('T') && !dateStr.endsWith('Z') ? dateStr + 'Z' : dateStr);
    return new Date(normalized).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  };

  const fetchTaskLinks = async (taskId: string | number) => {
    // Left as placeholder
  };

  const handleAddLink = async (targetTaskId: string | number) => {
    if (!editingTask) return;
    setIsLinkingTask(true);
    try {
      const res = await apiFetch('/api/task-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_task_id: editingTask.id,
          target_task_id: targetTaskId,
          link_type: selectedLinkType,
          user: currentUserName
        })
      });
      if (res.ok) {
        fetchTaskLinks(editingTask.id);
        setLinkSearchQuery('');
        toast.success("Task linked successfully");
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to link task');
      }
    } catch (err) {
      console.error('Failed to link task:', err);
      toast.error('Failed to link task');
    } finally {
      setIsLinkingTask(false);
    }
  };

  const handleRemoveLink = async (linkId: number) => {
    if (!editingTask) return;
    setIsRemovingLink(linkId);
    try {
      const res = await apiFetch(`/api/task-links/${linkId}?user=${encodeURIComponent(currentUserName)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTaskLinks(editingTask.id);
        toast.success("Link removed successfully");
      } else {
        toast.error("Failed to remove link");
      }
    } catch (err) {
      console.error('Failed to remove link:', err);
      toast.error('Failed to remove link');
    } finally {
      setIsRemovingLink(null);
    }
  };

  const fetchUsers = async () => {
    // left as placeholder if any components explicitly call it directly
  };

  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = onSnapshot(collection(db, 'users'), async (snapshot) => {
      const data = snapshot.docs.map(formatDoc) as AppUser[];
      setUsers(data);
      
      const me = data.find((u: AppUser) => u.email === currentUser.email);
      if (me) {
        setCurrentUserRole(me.role);
        setIsAccessDenied(false);
      } else {
        // Check if we are the very first user (bootstrapping admin)
        if (data.length === 0 && currentUser.email === 'dewangga@sirclo.com') {
          const syncRes = await apiFetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown',
              email: currentUser.email,
              role: 'admin'
            })
          });
          if (syncRes.ok) {
            const newUser = await syncRes.json();
            setCurrentUserRole(newUser.role);
            setIsAccessDenied(false);
          }
        } else {
          setIsAccessDenied(true);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser, currentUserName]);

  const fetchTasks = async () => {
    // Left as placeholder if anything explicitly calls it
  };

  useEffect(() => {
    if (!currentUser) return;
    
    setLoading(true);
    const q = query(
      collection(db, 'tasks'), 
      orderBy('created_at', 'desc'), 
      limit(5000)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(formatDoc);
      setTasks(data);
      setHasMoreTasks(data.length >= 5000);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const fetchMetadataOptions = async () => {
    // Placeholder
  };

  const fetchTemplates = async () => {
    // Placeholder
  };

  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribeMeta = onSnapshot(doc(db, 'metadata', 'dropdowns'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMetadataOptions({
          categories: data.categories || [],
          brands: data.brands || [],
          requestors: data.requestors || [],
          divisions: data.divisions || [],
          category_link: data.category_link || []
        });
      }
    });

    const unsubscribeTemplates = onSnapshot(collection(db, 'templates'), (snapshot) => {
      setTemplates(snapshot.docs.map(formatDoc) as Template[]);
    });

    const unsubscribeDataLinks = onSnapshot(collection(db, 'data_list_link'), (snapshot) => {
      const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DataListLink[];
      setDataLinks(links);
    });

    return () => {
      unsubscribeMeta();
      unsubscribeTemplates();
      unsubscribeDataLinks();
    };
  }, [currentUser]);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setIsSavingTemplate(true);
    try {
      const res = await apiFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: formData.description,
          category: formData.category,
          brand: formData.brand,
          priority: formData.priority,
          subtasks: formData.subtasks.map(st => ({ title: st.title }))
        })
      });
      if (res.ok) {
        setTemplateName('');
        setShowTemplateSave(false);
        fetchTemplates();
        toast.success("Template saved successfully");
      } else {
        toast.error("Failed to save template");
      }
    } catch (err) {
      console.error('Failed to save template:', err);
      toast.error("Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleApplyTemplate = (template: Template) => {
    setSelectedTemplateId(template.id);
    setFormData(prev => ({
      ...prev,
      description: template.description || prev.description,
      category: template.category || prev.category,
      brand: template.brand || prev.brand,
      priority: template.priority || prev.priority,
      subtasks: template.subtasks.map(st => ({
        id: Math.random().toString(36).substr(2, 9),
        title: st.title,
        completed: false,
        due_date: ''
      }))
    }));
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    setIsDeletingTemplate(true);
    try {
      const res = await apiFetch(`/api/templates/${selectedTemplateId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSelectedTemplateId('');
        setShowTemplateDeleteConfirm(false);
        fetchTemplates();
        toast.success("Template deleted successfully");
      } else {
        toast.error("Failed to delete template");
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
      toast.error("Failed to delete template");
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTask(true);
    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PATCH' : 'POST';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        if (!editingTask && pendingFiles.length > 0) {
          const newTask = await res.json();
          // Upload pending files for the new task
          for (const file of pendingFiles) {
            const uploadData = new FormData();
            uploadData.append('file', file);
            await apiFetch(`/api/tasks/${newTask.id}/attachments`, {
              method: 'POST',
              body: uploadData
            });
          }
          setTasks(prev => {
            if (prev.some(t => t.id === newTask.id)) return prev.map(t => t.id === newTask.id ? newTask : t);
            return [newTask, ...prev];
          });
        } else {
          const resultTask = await res.json();
          if (editingTask) {
             setTasks(prev => prev.map(t => t.id === resultTask.id ? resultTask : t));
          } else {
             setTasks(prev => {
               if (prev.some(t => t.id === resultTask.id)) return prev.map(t => t.id === resultTask.id ? resultTask : t);
               return [resultTask, ...prev];
             });
          }
        }
        
        closeModal();
        toast.success(editingTask ? "Task updated successfully" : "Task created successfully");
      } else {
        toast.error("Failed to save task");
      }
    } catch (err) {
      console.error('Failed to save task:', err);
      toast.error("Failed to save task");
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    setIsDeletingTaskInProgress(true);
    try {
      const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== id));
        closeModal();
        toast.success("Task deleted successfully");
      } else {
        console.error('Delete failed');
        toast.error('Failed to delete task.');
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast.error('Failed to delete task');
    } finally {
      setIsDeletingTask(false);
      setIsDeletingTaskInProgress(false);
    }
  };

  const openModal = async (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        assignee: task.assignee || '',
        request_date: task.request_date || getJakartaToday(),
        due_date: task.due_date || '',
        category: task.category || '',
        brand: task.brand || '',
        requestor: task.requestor || '',
        division: task.division || '',
        subtasks: task.subtasks || [],
        recurring_pattern: task.recurring_pattern || 'none'
      });
      fetchComments(task.id);
      fetchAttachments(task.id);
      fetchActivities(task.id);
      fetchTaskLinks(task.id);
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assignee: '',
        request_date: getJakartaToday(),
        due_date: '',
        category: '',
        brand: '',
        requestor: '',
        division: '',
        subtasks: [],
        recurring_pattern: 'none'
      });
      setComments([]);
    }
    setIsModalOpen(true);
    setSelectedTemplateId('');
    setShowTemplateDeleteConfirm(false);
  };

  const fetchComments = async (taskId: string | number) => {
    // Left as placeholder
  };

  const fetchActivities = async (taskId: string | number) => {
    // Left as placeholder
  };

  useEffect(() => {
    if (!editingTask?.id) return;
    
    // Subscribe to comments
    const unsubscribeComments = onSnapshot(
      query(collection(db, 'comments'), where('task_id', '==', editingTask.id)), 
      (snapshot) => { 
        const items = snapshot.docs.map(formatDoc);
        items.sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tB - tA; // desc
        });
        setComments(items); 
      },
      (error) => console.error("Comment listener error:", error)
    );
    
    // Subscribe to attachments
    const unsubscribeAttachments = onSnapshot(
      query(collection(db, 'attachments'), where('task_id', '==', editingTask.id)), 
      (snapshot) => { 
        const items = snapshot.docs.map(formatDoc);
        items.sort((a, b) => {
          const tA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
          const tB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
          return tB - tA;
        });
        setAttachments(items); 
      },
      (error) => console.error("Attachment listener error:", error)
    );
    
    // Subscribe to task links
    const unsubscribeLinks = onSnapshot(
      query(collection(db, 'task_links'), where('source_task_id', '==', editingTask.id)), 
      (snapshot) => { 
        const items = snapshot.docs.map(formatDoc);
        items.sort((a, b) => {
           const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
           const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
           return tB - tA;
        });
        setTaskLinks(items); 
      },
      (error) => console.error("Link listener error:", error)
    );
    
    // Subscribe to activities
    const unsubscribeActivities = onSnapshot(
      query(collection(db, 'activity_log'), where('task_id', '==', editingTask.id)), 
      (snapshot) => { 
        const items = snapshot.docs.map(formatDoc);
        items.sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tB - tA;
        });
        setActivities(items); 
      },
      (error) => console.error("Activity listener error:", error)
    );

    return () => {
      unsubscribeComments();
      unsubscribeAttachments();
      unsubscribeLinks();
      unsubscribeActivities();
    };
  }, [editingTask?.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !editingTask) return;

    setIsSubmittingComment(true);
    try {
      const res = await apiFetch(`/api/tasks/${editingTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: currentUserName,
          content: newComment
        })
      });

      if (res.ok) {
        setNewComment('');
        fetchComments(editingTask.id);
        fetchActivities(editingTask.id);
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t));
        toast.success("Comment added successfully");
      } else {
        toast.error("Failed to add comment");
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string | number) => {
    setIsDeletingComment(true);
    try {
      const res = await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok && editingTask) {
        setCommentToDelete(null);
        fetchComments(editingTask.id);
        fetchActivities(editingTask.id);
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, comment_count: Math.max(0, (t.comment_count || 0) - 1) } : t));
        toast.success("Comment deleted successfully");
      } else {
        toast.error("Failed to delete comment");
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast.error("Failed to delete comment");
    } finally {
      setIsDeletingComment(false);
    }
  };

  const handleUpdateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommentId || !editingCommentContent.trim() || !editingTask) return;

    setIsUpdatingComment(true);
    try {
      const res = await apiFetch(`/api/comments/${editingCommentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingCommentContent })
      });

      if (res.ok) {
        setEditingCommentId(null);
        setEditingCommentContent('');
        fetchComments(editingTask.id);
        fetchActivities(editingTask.id);
        toast.success("Comment updated successfully");
      } else {
        toast.error("Failed to update comment");
      }
    } catch (err) {
      console.error('Failed to update comment:', err);
      toast.error("Failed to update comment");
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const fetchAttachments = async (taskId: string | number) => {
    // Left as placeholder
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);

    if (!editingTask) {
      setPendingFiles(prev => [...prev, ...newFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    let uploadedCount = 0;
    try {
      for (let i = 0; i < newFiles.length; i++) {
        const formData = new FormData();
        formData.append('file', newFiles[i]);
        
        const res = await apiFetch(`/api/tasks/${editingTask.id}/attachments`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          throw new Error('Upload failed');
        } else {
          uploadedCount++;
        }
      }
    } catch (err) {
      console.error('Failed to upload file:', err);
      toast.error('Failed to upload one or more files');
    } finally {
      if (uploadedCount > 0) {
        fetchAttachments(editingTask.id);
        fetchActivities(editingTask.id);
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, attachment_count: (t.attachment_count || 0) + uploadedCount } : t));
        toast.success(`Successfully uploaded ${uploadedCount} file(s)`);
      }
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = (attachment: Attachment) => {
    if (attachment.url) {
      window.open(attachment.url, '_blank');
    } else {
      window.open(`/api/attachments/${attachment.id}/download`, '_blank');
    }
  };

  const handleDeleteAttachment = async (id: string | number) => {
    setIsDeletingAttachment(id);
    try {
      const res = await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (res.ok && editingTask) {
        setAttachmentToDelete(null);
        fetchAttachments(editingTask.id);
        fetchActivities(editingTask.id);
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, attachment_count: Math.max(0, (t.attachment_count || 0) - 1) } : t));
        toast.success("Attachment deleted successfully");
      } else {
        toast.error("Failed to delete attachment");
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      toast.error("Failed to delete attachment");
    } finally {
      setIsDeletingAttachment(null);
    }
  };

  const handleDragOverFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeaveFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    setIsDeletingTask(false);
    setPendingFiles([]);
  };

  const syncTaskStatus = useCallback(async (id: string | number, newStatus: TaskStatus) => {
    try {
      const res = await apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) {
        // Rollback on failure
        fetchTasks();
      } else {
        if (editingTask?.id === id) {
          fetchActivities(id);
        }
        if (newStatus === 'DONE' || newStatus === 'CLOSED') {
          // Delay briefly to allow backend trigger to finish
          setTimeout(() => fetchTasks(), 1000);
        }
      }
    } catch (err) {
      console.error('Failed to sync status:', err);
      fetchTasks();
    }
  }, [fetchTasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  }, [tasks]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    setTasks((prev) => {
      const activeIndex = prev.findIndex((t) => t.id === activeId);
      const overIndex = prev.findIndex((t) => t.id === overId);

      if (activeIndex === -1) return prev;

      const activeTask = prev[activeIndex];
      const overTask = overIndex !== -1 ? prev[overIndex] : null;
      const isOverAColumn = STATUS_COLUMNS.some((c) => c.id === overId);

      // Case 1: Dragging over a task in a different column
      if (overTask && activeTask.status !== overTask.status) {
        const updatedTasks = [...prev];
        updatedTasks[activeIndex] = { ...activeTask, status: overTask.status };
        return arrayMove(updatedTasks, activeIndex, overIndex);
      }

      // Case 2: Dragging over an empty column
      if (isOverAColumn && activeTask.status !== overId) {
        const updatedTasks = [...prev];
        updatedTasks[activeIndex] = { ...activeTask, status: overId as TaskStatus };
        // We don't move it to the end of the array, just update status
        return updatedTasks;
      }

      return prev;
    });
  }, []);

  const handleInlineUpdate = async (taskId: string, field: string, value: any) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
    
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value })
      });
      
      if (!res.ok) throw new Error('Failed to update task');

      if (field === 'status' && (value === 'DONE' || value === 'CLOSED')) {
        setTimeout(() => fetchTasks(), 1000);
      }
    } catch (error) {
      console.error('Error updating task inline:', error);
      // Revert on failure by re-fetching
      fetchTasks();
    }
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Capture original status before clearing activeTask
    const originalStatus = activeTask?.status;
    
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Determine the intended new status from the drop target synchronously
    let finalStatus: TaskStatus | null = null;
    if (STATUS_COLUMNS.some(c => c.id === overId)) {
      finalStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) finalStatus = overTask.status;
    }

    setTasks((prev) => {
      const activeIndex = prev.findIndex((t) => t.id === activeId);
      const overIndex = prev.findIndex((t) => t.id === overId);

      if (activeIndex === -1) return prev;

      const currentTask = prev[activeIndex];

      // Reordering within the same column
      if (overIndex !== -1 && activeId !== overId) {
        const overTask = prev[overIndex];
        if (currentTask.status === overTask.status) {
          return arrayMove(prev, activeIndex, overIndex);
        }
      }

      return prev;
    });

    // Sync with server if status changed
    if (originalStatus && finalStatus && originalStatus !== finalStatus) {
      await syncTaskStatus(activeId as string, finalStatus);
    }
  }, [activeTask, tasks, syncTaskStatus]);

  const totalPages = Math.ceil(filteredTasks.length / rowsPerPage);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const toggleAssigneeFilter = (assignee: string) => {
    setSelectedAssignees(prev => 
      prev.includes(assignee) 
        ? prev.filter(a => a !== assignee) 
        : [...prev, assignee]
    );
  };

  const handleRenameColumn = (id: TaskStatus, newLabel: string) => {
    setColumns(prev => prev.map(col => col.id === id ? { ...col, label: newLabel } : col));
  };

  const handleSortTasks = (id: TaskStatus, criteria: SortCriteria) => {
    setTasks(prev => {
      const columnTasks = prev.filter(t => t.status === id);
      const otherTasks = prev.filter(t => t.status !== id);

      const sorted = [...columnTasks].sort((a, b) => {
        switch (criteria) {
          case 'DUE_DATE':
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          case 'PRIORITY':
            return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
          case 'CATEGORY':
            return (a.category || '').localeCompare(b.category || '');
          case 'NEWEST_ID':
            return Number(b.id) - Number(a.id);
          default:
            return 0;
        }
      });

      return [...otherTasks, ...sorted];
    });
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT': return <AlertCircle className="w-4 h-4 text-[var(--danger-color)]" />;
      case 'HIGH': return <AlertCircle className="w-4 h-4 text-[var(--warning-color)]" />;
      case 'MEDIUM': return <Circle className="w-4 h-4 text-[var(--accent-color)]" />;
      case 'LOW': return <Circle className="w-4 h-4 text-[var(--success-color)]" />;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--bg-body)] transition-colors duration-200">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-color)]" />
      </div>
    );
  }

  if (isAccessDenied) {
    return (
      <div className="min-h-screen bg-[var(--bg-body)] flex items-center justify-center p-4 transition-colors duration-200">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-[var(--badge-danger-bg)] text-[var(--danger-color)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Access Denied</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Your account ({currentUser?.email}) is not registered in this application. Please contact the administrator to request access.
          </p>
          <button
            onClick={() => auth.signOut()}
            className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarVisible(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`bg-[var(--bg-sidebar)] text-[var(--text-sidebar)] transition-all duration-300 flex flex-col fixed lg:sticky top-0 h-screen z-50 shrink-0 border-r border-[var(--border-color)] ${
          isSidebarVisible 
            ? (isSidebarCollapsed ? 'w-16' : 'w-64') 
            : 'w-0 opacity-0 pointer-events-none'
        } ${isSidebarVisible ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Toggle Button - Desktop (Moved outside inner container to avoid overflow-hidden) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`hidden lg:flex absolute -right-3 top-[36px] -translate-y-1/2 w-6 h-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] shadow-md z-[100] transition-all duration-300 ${!isSidebarVisible ? 'invisible opacity-0' : 'visible opacity-100'}`}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} flex flex-col h-full transition-all duration-300 relative overflow-hidden`}>
          <div className="p-4 flex items-center border-b border-[var(--border-color)] h-[73px] shrink-0 relative">
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-[var(--bg-surface)] p-1 rounded shrink-0 border border-[var(--border-color)]">
                <Logo className="w-5 h-5 text-[var(--accent-color)]" />
              </div>
              <span className={`font-bold text-lg tracking-tight truncate transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 invisible w-0' : 'opacity-100 visible w-auto'}`}>
                IC System
              </span>
            </div>
          </div>

          <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto scrollbar-hide">
            <SidebarItem 
              icon={<Layout className="w-5 h-5" />} 
              label="Tasks" 
              active={currentView === 'tasks'} 
              collapsed={isSidebarCollapsed} 
              visible={isSidebarVisible}
              onClick={() => setCurrentView('tasks')}
            />
            <SidebarItem 
              icon={<ListIcon className="w-5 h-5" />} 
              label="Data List" 
              active={currentView.startsWith('data-list')} 
              collapsed={isSidebarCollapsed} 
              visible={isSidebarVisible}
              subItems={[
                { label: 'Data List Link', active: currentView === 'data-list-link', onClick: () => setCurrentView('data-list-link') },
                { label: 'Data List Jadwal', active: currentView === 'data-list-jadwal', onClick: () => setCurrentView('data-list-jadwal') },
                { label: 'Data List Klaim', active: currentView === 'data-list-klaim', onClick: () => setCurrentView('data-list-klaim') },
                { label: 'Data List Warehouse', active: currentView === 'data-list-warehouse', onClick: () => setCurrentView('data-list-warehouse') },
              ]}
            />
            <SidebarItem 
              icon={<BarChart3 className="w-5 h-5" />} 
              label="Reports" 
              active={currentView === 'reports'}
              collapsed={isSidebarCollapsed} 
              visible={isSidebarVisible}
              onClick={() => setCurrentView('reports')}
            />
            {currentUserRole === 'admin' && (
              <SidebarItem 
                icon={<History className="w-5 h-5" />} 
                label="Audit Log" 
                active={currentView === 'audit'}
                collapsed={isSidebarCollapsed} 
                visible={isSidebarVisible}
                onClick={() => setCurrentView('audit')}
              />
            )}
            <div className="pt-4 mt-4 border-t border-[var(--border-color)]">
              <SidebarItem 
                icon={<Settings className="w-5 h-5" />} 
                label="Settings" 
                active={currentView === 'settings'}
                collapsed={isSidebarCollapsed} 
                visible={isSidebarVisible}
                onClick={() => setCurrentView('settings')}
              />
            </div>
          </nav>

        <div className="p-4 border-t border-[var(--border-color)] shrink-0 overflow-hidden">
          <div className="flex items-center gap-3">
            {currentUserPhoto ? (
              <img 
                src={currentUserPhoto} 
                alt={currentUserName} 
                className="w-8 h-8 rounded-full shadow-sm shrink-0 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-on-accent)] text-xs font-bold shadow-sm shrink-0"
                style={{ backgroundColor: getAvatarColor(currentUserName).bg, color: getAvatarColor(currentUserName).text }}
              >
                {getInitials(currentUserName)}
              </div>
            )}
            <div className={`overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 invisible w-0' : 'opacity-100 visible w-auto'}`}>
              <p className="text-sm font-medium truncate">{currentUserName}</p>
              <p className="text-[10px] text-[var(--text-sidebar-muted)] truncate">{currentUser?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] flex flex-col sticky top-0 z-40 shrink-0 transition-colors duration-200">
          {/* Top Row: Title, Search, Actions */}
          <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 shrink-0">
              <button 
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                className="p-1.5 hover:bg-[var(--bg-secondary)] rounded transition-colors text-[var(--text-secondary)]"
                title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
              >
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {currentView === 'settings' ? 'Settings' 
                  : currentView === 'reports' ? 'Reports' 
                  : currentView === 'audit' ? 'Audit Log' 
                  : currentView === 'data-list-link' ? 'Data List Link'
                  : currentView === 'data-list-jadwal' ? 'Data List Jadwal'
                  : currentView === 'data-list-klaim' ? 'Data List Klaim'
                  : currentView === 'data-list-warehouse' ? 'Data List Warehouse'
                  : 'Tasks'}
              </h2>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end">
              {['tasks', 'data-list-link'].includes(currentView) && (
                <div className="relative hidden md:block max-w-md w-full ml-4">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input 
                    type="text" 
                    placeholder={currentView === 'data-list-link' ? 'Search links...' : 'Search tasks...'}
                    className="pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] w-full text-[var(--text-primary)] transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button 
                  onClick={async () => {
                    setIsRefreshing(true);
                    await Promise.all([
                      fetchTasks(),
                      fetchUsers(),
                      fetchTemplates(),
                      fetchMetadataOptions()
                    ]);
                    setTimeout(() => setIsRefreshing(false), 500); // 500ms guaranteed spin
                  }}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-secondary)]"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>

                {/* Notifications */}
                <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-secondary)] relative"
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[var(--bg-surface)]"></span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-secondary)]">
                        <h3 className="font-bold text-sm text-[var(--text-primary)]">Notifications</h3>
                        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-full">
                          {notifications.filter(n => !n.read).length} new
                        </span>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map(notif => (
                            <div 
                              key={notif.id} 
                              className={`p-4 border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer ${!notif.read ? 'bg-[var(--bg-secondary)] bg-opacity-50' : ''}`}
                              onClick={() => {
                                if (!notif.read) markNotificationAsRead(notif.id);
                                setShowNotifications(false);
                                if (notif.task_display_id) {
                                  const targetTask = tasks.find(t => t.display_id === notif.task_display_id || `IC-${t.id}` === notif.task_display_id);
                                  if (targetTask) {
                                    setCurrentView('tasks');
                                    openModal(targetTask);
                                  }
                                }
                              }}
                            >
                              <div className="flex gap-3">
                                <div className="mt-0.5">
                                  {!notif.read ? (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                                  ) : (
                                    <div className="w-2 h-2 bg-transparent rounded-full mt-1.5"></div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                    {notif.title}
                                  </p>
                                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                                    {notif.message ? notif.message.replace(/<[^>]*>?/gm, '') : ''}
                                  </p>
                                  <p className="text-[10px] text-[var(--text-muted)] mt-2">
                                    {formatDateTime(notif.created_at?.toDate ? notif.created_at.toDate().toISOString() : notif.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={toggleTheme}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-secondary)]"
                  title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                >
                  {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => {
                    import('./firebase').then(({ logOut }) => logOut());
                  }}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-secondary)]"
                  title="Sign Out"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
                {currentView === 'tasks' && (
                  <button 
                    onClick={() => openModal()}
                    className="btn-primary px-3 py-2 md:px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ml-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Create</span>
                  </button>
                )}
                {currentView === 'data-list-link' && (
                  <button 
                    onClick={() => dataListLinkRef.current?.openAddModal()}
                    className="btn-primary px-3 py-2 md:px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ml-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Link</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Filters (Only for Tasks) */}
          {currentView === 'tasks' && (
            <div className="px-4 md:px-6 py-2.5 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-surface)]">
              <div className="flex items-center gap-2 shrink-0">
                {/* Filter Menu */}
                <div className="relative group/main">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-primary)] transition-colors">
                    <Filter className="w-3.5 h-3.5" />
                    Filters {(selectedStatuses.length + selectedPriorities.length + selectedCategories.length + selectedBrands.length) > 0 && `(${selectedStatuses.length + selectedPriorities.length + selectedCategories.length + selectedBrands.length})`}
                  </button>
                  <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/main:opacity-100 group-hover/main:visible transition-all z-50 py-2">
                    
                    {/* Status Submenu */}
                    <div className="relative group/status px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                      <span className="font-medium">Status {selectedStatuses.length > 0 && `(${selectedStatuses.length})`}</span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/status:text-[var(--text-primary)]" />
                      
                      <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                        <div className="space-y-1">
                          {STATUS_COLUMNS.map(status => (
                            <label key={status.id} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={selectedStatuses.includes(status.id)}
                                onChange={() => {
                                  setSelectedStatuses(prev => 
                                    prev.includes(status.id) ? prev.filter(s => s !== status.id) : [...prev, status.id]
                                  );
                                  setCurrentPage(1);
                                }}
                                className="rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--accent-color)] focus:ring-[var(--border-focus)]"
                              />
                              <span className="text-xs text-[var(--text-primary)]">{status.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Priority Submenu */}
                    <div className="relative group/priority px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                      <span className="font-medium">Priority {selectedPriorities.length > 0 && `(${selectedPriorities.length})`}</span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/priority:text-[var(--text-primary)]" />
                      
                      <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/priority:opacity-100 group-hover/priority:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                        <div className="space-y-1">
                          {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map(priority => (
                            <label key={priority} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={selectedPriorities.includes(priority)}
                                onChange={() => {
                                  setSelectedPriorities(prev => 
                                    prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]
                                  );
                                  setCurrentPage(1);
                                }}
                                className="rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--accent-color)] focus:ring-[var(--border-focus)]"
                              />
                              <span className="text-xs text-[var(--text-primary)]">{priority}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Category Submenu */}
                    {uniqueCategories.length > 0 && (
                      <div className="relative group/category px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                        <span className="font-medium">Category {selectedCategories.length > 0 && `(${selectedCategories.length})`}</span>
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/category:text-[var(--text-primary)]" />
                        
                        <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/category:opacity-100 group-hover/category:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                          <div className="space-y-1">
                            {uniqueCategories.map(cat => (
                              <label key={cat} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={selectedCategories.includes(cat)}
                                  onChange={() => {
                                    setSelectedCategories(prev => 
                                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                    );
                                    setCurrentPage(1);
                                  }}
                                  className="rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--accent-color)] focus:ring-[var(--border-focus)]"
                                />
                                <span className="text-xs text-[var(--text-primary)]">{cat}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Brand Submenu */}
                    {uniqueBrands.length > 0 && (
                      <div className="relative group/brand px-4 py-2 hover:bg-[var(--bg-primary)] cursor-pointer flex justify-between items-center text-sm text-[var(--text-primary)]">
                        <span className="font-medium">Brand {selectedBrands.length > 0 && `(${selectedBrands.length})`}</span>
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover/brand:text-[var(--text-primary)]" />
                        
                        <div className="absolute top-0 left-full ml-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-lg opacity-0 invisible group-hover/brand:opacity-100 group-hover/brand:visible transition-all z-50 p-2 max-h-96 overflow-y-auto">
                          <div className="space-y-1">
                            {uniqueBrands.map(brand => (
                              <label key={brand} className="flex items-center gap-2 p-1.5 hover:bg-[var(--bg-primary)] rounded cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={selectedBrands.includes(brand)}
                                  onChange={() => {
                                    setSelectedBrands(prev => 
                                      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
                                    );
                                    setCurrentPage(1);
                                  }}
                                  className="rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--accent-color)] focus:ring-[var(--border-focus)]"
                                />
                                <span className="text-xs text-[var(--text-primary)]">{brand}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* View Toggle */}
                <div className="flex items-center bg-[var(--bg-secondary)] p-1 rounded-md border border-[var(--border-color)] ml-2">
                  <button 
                    onClick={() => setViewMode('board')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'board' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    title="Board View"
                  >
                    <Layout className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Board</span>
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    title="List View"
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                  <button 
                    onClick={() => setViewMode('gantt')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'gantt' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    title="Gantt View"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Gantt</span>
                  </button>
                </div>

                <div className="w-px h-6 bg-[var(--border-color)] mx-1" />

                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={importInputRef}
                  onChange={handleImportData}
                />
                
                <div className="relative">
                  <button 
                    onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)] transition-colors"
                    title="Data Tools"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tools</span>
                  </button>

                  {isToolsMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setIsToolsMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-1 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-lg rounded-md z-50 overflow-hidden divide-y divide-[var(--border-color)]">
                        {currentUserRole === 'admin' && (
                          <>
                            <button 
                              onClick={() => {
                                importInputRef.current?.click();
                                setIsToolsMenuOpen(false);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)] transition-all"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Import Tasks (CSV)
                            </button>
                            <a 
                              href="/task_import_template.csv" 
                              download
                              onClick={() => setIsToolsMenuOpen(false)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)] transition-all"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Download Template
                            </a>
                          </>
                        )}
                        <button 
                          onClick={() => {
                            handleExportData();
                            setIsToolsMenuOpen(false);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)] transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export Tasks (CSV)
                        </button>
                        <button 
                          onClick={async () => {
                            setIsToolsMenuOpen(false);
                            const toastId = toast.loading('Backing up data to Google Sheets...');
                            try {
                              const res = await apiFetch('/api/backup-to-sheets', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  sheetId: '1NbsPeG4LH4i6-VdmA3qCgBGxivKXTEuAvfh6VnzGrh0',
                                  tasks: tasks // directly passing front-end state 
                                })
                              });
                              if (!res.ok) throw new Error('Task backup failed');
                              
                              const linksRes = await apiFetch('/api/backup-links-to-sheets', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  sheetId: '1NbsPeG4LH4i6-VdmA3qCgBGxivKXTEuAvfh6VnzGrh0',
                                  sheetName: 'LINK',
                                  links: dataLinks // directly passing front-end state
                                })
                              });
                              if (!linksRes.ok) throw new Error('Links backup failed');
                              
                              toast.success('Backup to Google Sheets completed successfully!', { id: toastId });
                            } catch (error) {
                              console.error(error);
                              toast.error('Failed to backup to Google Sheets. Check configuration.', { id: toastId, duration: 8000 });
                            }
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)] transition-all"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Backup to Sheets
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {/* Mobile Search */}
                <div className="relative md:hidden w-40 sm:w-48">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    className="pl-10 pr-4 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] w-full text-[var(--text-primary)] transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {(searchQuery.length > 0 || selectedAssignees.length > 0 || selectedStatuses.length > 0 || selectedPriorities.length > 0 || selectedCategories.length > 0 || selectedBrands.length > 0) && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedAssignees([]);
                      setSelectedStatuses([]);
                      setSelectedPriorities([]);
                      setSelectedCategories([]);
                      setSelectedBrands([]);
                      setCurrentPage(1);
                    }}
                    className="text-xs text-[var(--accent-color)] hover:underline font-medium whitespace-nowrap"
                  >
                    Clear all filters
                  </button>
                )}

                {/* Assignees */}
                <div className="flex items-center -space-x-2 mr-2">
                  {hasUnassignedTasks && (
                    <button
                      onClick={() => toggleAssigneeFilter('Unassigned')}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                        selectedAssignees.includes('Unassigned')
                          ? 'ring-2 ring-blue-400 scale-110 z-10 border-[var(--bg-surface)]'
                          : 'border-[var(--bg-surface)] hover:scale-105'
                      } bg-[var(--bg-secondary)] text-[var(--text-muted)]`}
                      title="Unassigned"
                    >
                      <User className="w-4 h-4" />
                    </button>
                  )}
                  {uniqueAssignees.map((assignee) => {
                    const colors = getAvatarColor(assignee);
                    const isSelected = selectedAssignees.includes(assignee);
                    return (
                      <button
                        key={assignee}
                        onClick={() => toggleAssigneeFilter(assignee)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                          isSelected
                            ? 'ring-2 ring-blue-400 scale-110 z-10 border-[var(--bg-surface)]'
                            : 'border-[var(--bg-surface)] hover:scale-105'
                        }`}
                        title={assignee}
                        style={{ 
                          backgroundColor: colors.bg,
                          color: colors.text
                        }}
                      >
                        {getInitials(assignee)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </header>

        {currentView === 'settings' ? (
          <SettingsView 
            users={users} 
            currentUserRole={currentUserRole} 
            onUsersChange={fetchUsers} 
            theme={theme}
            setTheme={setTheme}
            notificationConfig={notificationConfig}
            updateNotificationConfig={updateNotificationConfig}
            backupConfig={backupConfig}
            updateBackupConfig={updateBackupConfig}
          />
        ) : currentView === 'reports' ? (
          <ReportsView tasks={tasks} />
        ) : currentView === 'audit' ? (
          currentUserRole === 'admin' ? (
            <AuditLogView logs={systemLogs} tasks={tasks} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[var(--bg-body)]">
              <div className="text-center">
                <History className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Access Denied</h2>
                <p className="text-[var(--text-secondary)] mt-2">Only administrators can view the audit log.</p>
              </div>
            </div>
          )
        ) : currentView === 'data-list-link' ? (
          <DataListLinkView 
            ref={dataListLinkRef}
            dataLinks={dataLinks} 
            searchQuery={searchQuery}
            categories={Array.from(new Set([...metadataOptions.category_link, ...dataLinks.map(l => l.category).filter(Boolean)]))} 
          />
        ) : currentView.startsWith('data-list-') ? (
          <div className="flex-1 flex flex-col p-6 bg-[var(--bg-body)]">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-8 text-center shadow-sm">
              <ListIcon className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                {currentView === 'data-list-link' ? 'Data List Link'
                  : currentView === 'data-list-jadwal' ? 'Data List Jadwal'
                  : currentView === 'data-list-klaim' ? 'Data List Klaim'
                  : currentView === 'data-list-warehouse' ? 'Data List Warehouse'
                  : 'Data List'}
              </h2>
              <p className="text-[var(--text-secondary)]">
                This module is under construction. Data will be displayed here soon.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Main Content */}
            <main className={`flex-1 flex flex-col min-h-0 ${viewMode === 'board' ? 'p-6 overflow-x-auto overflow-y-hidden' : 'p-6 overflow-hidden'}`}>
        {viewMode === 'board' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 min-w-max flex-1 min-h-0">
              {columns.map(column => (
                <KanbanColumn
                  key={column.id}
                  id={column.id}
                  label={column.label}
                  tasks={filteredTasks.filter(t => t.status === column.id)}
                  onAddTask={(status) => {
                    setFormData(prev => ({ ...prev, status }));
                    openModal();
                  }}
                  onTaskClick={openModal}
                  getPriorityIcon={getPriorityIcon}
                  onRenameColumn={handleRenameColumn}
                  onSortTasks={handleSortTasks}
                  currentUserRole={currentUserRole}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? (() => {
                const isOverdue = activeTask.due_date && 
                  new Date(activeTask.due_date).setHours(23, 59, 59, 999) < new Date().getTime() && 
                  activeTask.status !== 'DONE' && 
                  activeTask.status !== 'CLOSED';
                
                return (
                  <div className={`task-card shadow-xl scale-105 opacity-90 cursor-grabbing border ${
                    isOverdue 
                      ? 'border-[var(--danger-color)] bg-[var(--badge-danger-bg)]' 
                      : 'border-[var(--accent-color)] bg-[var(--bg-surface)]'
                  }`}>
                    <p className="text-sm text-[var(--text-primary)] mb-1 leading-tight font-medium pr-6">
                      {activeTask.title}
                    </p>
                    {activeTask.description && (
                      <p className="text-[11px] text-[var(--text-muted)] mb-3 line-clamp-2 leading-normal">
                        {activeTask.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {activeTask.category && (
                        <span className="text-[10px] px-1.5 py-0.5 badge-accent rounded font-medium">
                          {activeTask.category}
                        </span>
                      )}
                      {activeTask.brand && (
                        <span className="text-[10px] px-1.5 py-0.5 badge-purple rounded font-medium">
                          {activeTask.brand}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(activeTask.priority)}
                        <span className="text-[10px] font-bold text-[var(--text-muted)]">{activeTask.display_id || `IC-${activeTask.id}`}</span>
                      </div>
                    </div>
                  </div>
                );
              })() : null}
            </DragOverlay>
          </DndContext>
        ) : viewMode === 'gantt' ? (
          <GanttView 
            tasks={filteredTasks}
            onTaskClick={openModal}
            getPriorityIcon={getPriorityIcon}
            getAvatarColor={getAvatarColor}
            getInitials={getInitials}
          />
        ) : (
          <TaskListView 
            tasks={paginatedTasks} 
            users={users}
            onTaskClick={openModal} 
            onInlineUpdate={handleInlineUpdate}
            getPriorityIcon={getPriorityIcon}
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(1);
            }}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={(field) => {
              if (sortField === field) {
                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              } else {
                setSortField(field);
                setSortOrder('asc');
              }
            }}
          />
        )}
        
        {hasMoreTasks && (
          <div className="flex justify-center mt-8 pb-8">
            <button
              onClick={() => setTaskLimit(prev => prev + 50)}
              className="px-6 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-sm font-medium hover:bg-[var(--bg-surface)] hover:text-[var(--accent-color)] transition-colors shadow-sm flex items-center gap-2"
            >
              Load More Tasks
            </button>
          </div>
        )}
        </main>
          </>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[var(--bg-surface)] w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-200"
            >
              <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  {editingTask ? `Edit Issue ${editingTask.display_id || `IC-${editingTask.id}`}` : 'Create Issue'}
                </h3>
                <div className="flex items-center gap-2">
                  {!editingTask && templates.length > 0 && (
                    <div className="flex items-center gap-1">
                      <select 
                        className="text-xs px-2 py-1 border border-[var(--border-color)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                        value={selectedTemplateId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setSelectedTemplateId('');
                          } else {
                            const template = templates.find(t => String(t.id) === String(val));
                            if (template) {
                              setSelectedTemplateId(template.id as any);
                              handleApplyTemplate(template);
                            }
                          }
                        }}
                      >
                        <option value="">Use Template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {selectedTemplateId && (
                        <div className="flex items-center">
                          {showTemplateDeleteConfirm ? (
                            <div className="flex items-center gap-1 bg-[var(--badge-danger-bg)] rounded-md p-1 border border-[var(--danger-color)] border-opacity-30">
                              <span className="text-[10px] font-bold text-[var(--danger-color)] px-1">Delete?</span>
                              <button 
                                type="button"
                                onClick={handleDeleteTemplate}
                                disabled={isDeletingTemplate}
                                className="bg-[var(--danger-color)] text-[var(--text-on-accent)] text-[10px] font-bold px-2 py-1 rounded hover:bg-[var(--danger-hover)] transition-colors disabled:opacity-50"
                              >
                                {isDeletingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                              </button>
                              <button 
                                type="button"
                                onClick={() => setShowTemplateDeleteConfirm(false)}
                                disabled={isDeletingTemplate}
                                className="text-[var(--text-muted)] text-[10px] font-bold px-2 py-1 rounded hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowTemplateDeleteConfirm(true)}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--danger-color)] rounded hover:bg-[var(--bg-secondary)] transition-colors"
                              title="Delete Template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {editingTask && (
                    <div className="flex items-center">
                      {isDeletingTask ? (
                        <div className="flex items-center gap-1 bg-[var(--badge-danger-bg)] rounded-md p-1 border border-[var(--danger-color)] border-opacity-30">
                          <span className="text-[10px] font-bold text-[var(--danger-color)] px-1">Confirm?</span>
                          <button 
                            type="button"
                            onClick={() => handleDelete(editingTask.id)}
                            disabled={isDeletingTaskInProgress}
                            className="bg-[var(--danger-color)] text-[var(--text-on-accent)] text-[10px] font-bold px-2 py-1 rounded hover:bg-[var(--danger-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {isDeletingTaskInProgress && <Loader2 className="w-3 h-3 animate-spin" />}
                            Yes
                          </button>
                          <button 
                            type="button"
                            onClick={() => setIsDeletingTask(false)}
                            disabled={isDeletingTaskInProgress}
                            className="text-[var(--danger-color)] hover:bg-[var(--badge-danger-bg)] text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => setIsDeletingTask(true)}
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--danger-color)] hover:bg-[var(--badge-danger-bg)] rounded-md transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  )}
                  <button onClick={closeModal} disabled={isSavingTask} className="p-2 hover:bg-[var(--bg-secondary)] rounded-md transition-colors disabled:opacity-50">
                    <X className="w-5 h-5 text-[var(--text-secondary)]" />
                  </button>
                </div>
              </div>

              <form id="task-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Summary</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="What needs to be done?"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Description</label>
                  <RichTextEditor 
                    content={formData.description}
                    onChange={(html) => setFormData({ ...formData, description: html })}
                    users={users}
                    placeholder="Add more details... (Type @ to mention someone)"
                    minHeight="120px"
                  />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Request Date</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      value={formData.request_date}
                      onChange={e => setFormData({ ...formData, request_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Due Date</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      value={formData.due_date}
                      onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Repeat Task</label>
                    <select
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      value={formData.recurring_pattern}
                      onChange={e => setFormData({ ...formData, recurring_pattern: e.target.value as 'none' | 'daily' | 'weekly' | 'monthly' })}
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                {editingTask && (
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Created By</label>
                      <div className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded text-sm">
                        {editingTask.authorName || 'Unknown'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Created At</label>
                      <div className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded text-sm">
                        {formatDateTime(editingTask.created_at)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Category</label>
                    <input 
                      type="text"
                      list="categories"
                      className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g. Create Movement, Adjustment Stock"
                    />
                    <datalist id="categories">
                      {uniqueCategories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Brand</label>
                    <input 
                      type="text"
                      list="brands"
                      className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                      value={formData.brand}
                      onChange={e => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="e.g. Levis, Samsonite"
                    />
                    <datalist id="brands">
                      {uniqueBrands.map(brand => <option key={brand} value={brand} />)}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Requestor</label>
                    <input 
                      type="text"
                      list="requestors"
                      className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                      value={formData.requestor}
                      onChange={e => setFormData({ ...formData, requestor: e.target.value })}
                      placeholder="Who requested this?"
                    />
                    <datalist id="requestors">
                      {uniqueRequestors.map(req => <option key={req} value={req} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Division</label>
                    <input 
                      type="text"
                      list="divisions"
                      className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                      value={formData.division}
                      onChange={e => setFormData({ ...formData, division: e.target.value })}
                      placeholder="e.g. Operations, Commercial"
                    />
                    <datalist id="divisions">
                      {uniqueDivisions.map(div => <option key={div} value={div} />)}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Status</label>
                    <select 
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    >
                      {columns.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Priority</label>
                    <select 
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    >
                      {PRIORITIES.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Assignee</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <select 
                      className="w-full pl-10 pr-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] appearance-none"
                      value={formData.assignee}
                      onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sub-tasks Section */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-[var(--text-muted)]" />
                      <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase">Sub-tasks</h4>
                    </div>
                    <button
                      type="button"
                      onClick={addSubTask}
                      className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-color)] hover:text-[var(--accent-hover)]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Sub-task
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formData.subtasks?.map((st) => (
                      <div key={st.id} className="flex items-center gap-3 group">
                        <button
                          type="button"
                          onClick={() => toggleSubTask(st.id)}
                          className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            st.completed 
                              ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-[var(--text-on-accent)]' 
                              : 'border-[var(--border-color)] hover:border-[var(--border-focus)]'
                          }`}
                        >
                          {!!st.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        <input
                          type="text"
                          className={`flex-1 bg-transparent border-none focus:ring-0 text-sm p-0 ${
                            st.completed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'
                          }`}
                          value={st.title}
                          onChange={(e) => updateSubTaskTitle(st.id, e.target.value)}
                          placeholder="What needs to be done?"
                        />
                        <div className={`flex items-center gap-1 transition-opacity ${st.due_date || (st.assignee && st.assignee !== formData.assignee) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <select
                            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] rounded px-1.5 py-1 outline-none w-24"
                            value={st.assignee || ''}
                            onChange={(e) => updateSubTaskAssignee(st.id, e.target.value)}
                            title={st.assignee ? `Subtask assigned to: ${st.assignee}` : 'Assign subtask'}
                          >
                            <option value="">(Inherit)</option>
                            {users.map(u => (
                              <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                            <option value="Unassigned">Unassigned</option>
                          </select>
                          <div className="relative flex items-center">
                            <CalendarDays className="w-3.5 h-3.5 absolute left-2 text-[var(--text-muted)] pointer-events-none" />
                            <input
                              type="date"
                              className="pl-7 pr-2 py-1 text-[10px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] text-[var(--text-primary)] w-28"
                              value={st.due_date || ''}
                              onChange={(e) => updateSubTaskDueDate(st.id, e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteSubTask(st.id)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--danger-color)]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!formData.subtasks || formData.subtasks.length === 0) && (
                      <p className="text-xs text-[var(--text-muted)] italic py-2">No sub-tasks yet.</p>
                    )}
                  </div>
                </div>

                {/* Attachments Section */}
                <div 
                  className={`mt-8 p-4 border-2 border-dashed rounded-lg transition-colors ${
                    isDragOver 
                      ? 'border-[var(--border-focus)] bg-[var(--badge-accent-bg)]' 
                      : 'border-[var(--border-color)] bg-[var(--bg-primary)]'
                  }`}
                  onDragOver={handleDragOverFile}
                  onDragLeave={handleDragLeaveFile}
                  onDrop={handleDropFile}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-[var(--text-muted)]" />
                      <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase">Attachments</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-color)] hover:text-[var(--accent-hover)] disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      Upload
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                  </div>

                  {/* Existing Attachments (Edit Mode) */}
                  {editingTask && attachments.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {attachments.map((file) => (
                        <div 
                          key={file.id}
                          className="flex items-center justify-between p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="p-1.5 bg-[var(--badge-accent-bg)] rounded">
                              <FileText className="w-4 h-4 text-[var(--accent-color)]" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-[var(--text-primary)] truncate" title={file.original_name}>
                                {file.original_name}
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {attachmentToDelete === file.id ? (
                              <div className="flex items-center gap-1 bg-[var(--badge-danger-bg)] rounded-md p-0.5 border border-[var(--danger-color)] border-opacity-30">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteAttachment(file.id);
                                  }}
                                  disabled={isDeletingAttachment === file.id}
                                  className="text-[var(--danger-color)] hover:bg-[var(--danger-color)] hover:text-white text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                  {isDeletingAttachment === file.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Yes
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setAttachmentToDelete(null);
                                  }}
                                  disabled={isDeletingAttachment === file.id}
                                  className="text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDownload(file)}
                                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--badge-accent-bg)] rounded"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setAttachmentToDelete(file.id);
                                  }}
                                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger-color)] hover:bg-[var(--badge-danger-bg)] rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending Attachments (Create Mode or Adding in Edit Mode) */}
                  {pendingFiles.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {pendingFiles.map((file, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-2 bg-[var(--bg-surface)] border border-[var(--accent-color)] border-opacity-30 border-dashed rounded group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="p-1.5 bg-[var(--badge-accent-bg)] rounded">
                              <FileText className="w-4 h-4 text-[var(--accent-color)]" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-[var(--text-primary)] truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                {formatFileSize(file.size)} (Pending)
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePendingFile(index)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger-color)] hover:bg-[var(--badge-danger-bg)] rounded"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {attachments.length === 0 && pendingFiles.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-xs text-[var(--text-muted)]">
                        No attachments yet. Drag and drop files here or click Upload.
                      </p>
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                {editingTask && (
                  <div className="pt-6 border-t border-[var(--border-color)]">
                    <div className="flex items-center gap-2 mb-4">
                      <MessageSquare className="w-4 h-4 text-[var(--text-secondary)]" />
                      <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase">Comments</h4>
                    </div>

                    <div className="space-y-4 mb-6">
                      {comments.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)] italic">No comments yet.</p>
                      ) : (
                        comments.map(comment => {
                          const colors = getAvatarColor(comment.author);
                          return (
                            <div key={comment.id} className="flex gap-3 group">
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm"
                                style={{ backgroundColor: colors.bg, color: colors.text }}
                              >
                                {getInitials(comment.author)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-bold text-[var(--text-primary)]">{comment.author}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                      {formatDateTime(comment.created_at)}
                                      {comment.updated_at && (
                                        <span className="italic opacity-70">(edited)</span>
                                      )}
                                    </span>
                                    {(comment.author === currentUserName || comment.author === myNameInDb) && (
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {commentToDelete === comment.id ? (
                                          <div className="flex items-center gap-1 bg-[var(--badge-danger-bg)] rounded-md p-0.5 border border-[var(--danger-color)] border-opacity-30">
                                            <button 
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleDeleteComment(comment.id);
                                              }}
                                              disabled={isDeletingComment}
                                              className="bg-[var(--danger-color)] text-[var(--text-on-accent)] text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-[var(--danger-hover)] disabled:opacity-50"
                                            >
                                              {isDeletingComment ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Delete'}
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setCommentToDelete(null);
                                              }}
                                              disabled={isDeletingComment}
                                              className="text-[var(--text-muted)] text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                                            >
                                              No
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <button 
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEditingCommentId(comment.id);
                                                setEditingCommentContent(comment.content);
                                              }}
                                              className="p-1 text-[var(--accent-color)] hover:bg-[var(--badge-accent-bg)] rounded transition-all"
                                              title="Edit"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setCommentToDelete(comment.id);
                                              }}
                                              className="p-1 text-[var(--danger-color)] hover:bg-[var(--badge-danger-bg)] rounded transition-all"
                                              title="Delete"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {editingCommentId === comment.id ? (
                                  <div className="mt-1">
                                    <RichTextEditor 
                                      content={editingCommentContent}
                                      onChange={(html) => setEditingCommentContent(html)}
                                      users={users}
                                      placeholder="Edit comment..."
                                      minHeight="60px"
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingCommentId(null)}
                                        disabled={isUpdatingComment}
                                        className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] rounded disabled:opacity-50"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleUpdateComment}
                                        disabled={isUpdatingComment || !editingCommentContent.trim() || editingCommentContent === '<p></p>'}
                                        className="px-2 py-1 text-[10px] font-bold btn-primary rounded hover:bg-[var(--accent-hover)] disabled:opacity-50"
                                      >
                                        {isUpdatingComment ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Update'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div 
                                    className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1"
                                    dangerouslySetInnerHTML={{ __html: comment.content }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex gap-3">
                      {currentUserPhoto ? (
                        <img 
                          src={currentUserPhoto} 
                          alt={currentUserName} 
                          className="w-8 h-8 rounded-full shadow-sm shrink-0 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-on-accent)] text-xs font-bold shrink-0 shadow-sm"
                          style={{ backgroundColor: getAvatarColor(currentUserName).bg, color: getAvatarColor(currentUserName).text }}
                        >
                          {getInitials(currentUserName)}
                        </div>
                      )}
                      <div className="flex-1 relative flex flex-col gap-2">
                        <RichTextEditor 
                          content={newComment}
                          onChange={(html) => setNewComment(html)}
                          users={users}
                          placeholder="Add a comment... (Type @ to mention someone)"
                          minHeight="60px"
                        />
                        <div className="flex justify-end">
                          <button 
                            disabled={isSubmittingComment || !newComment.trim() || newComment === '<p></p>'}
                            onClick={handleAddComment}
                            className="p-1.5 px-3 btn-primary rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
                          >
                            {isSubmittingComment ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>Send</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Linked Tasks Section */}
                {editingTask && (
                  <div className="pt-6 border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                        <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase">Linked Tasks</h4>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {taskLinks.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)] italic">No linked tasks yet.</p>
                      ) : (
                        taskLinks.map(link => (
                          <div key={link.id} className="flex items-center justify-between p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded group">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[10px] font-bold text-[var(--text-muted)] uppercase">
                                {link.link_type.replace(/_/g, ' ')}
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                                  <span className="text-[var(--text-muted)] mr-1">#{link.target_task_display_id || link.target_task_id}</span>
                                  {link.target_task_title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[10px] px-1 rounded-sm ${
                                    link.target_task_status === 'DONE' ? 'badge-success' :
                                    link.target_task_status === 'REVIEW' ? 'badge-accent' :
                                    link.target_task_status === 'IN_PROGRESS' ? 'badge-warning' :
                                    'badge-neutral'
                                  }`}>
                                    {link.target_task_status}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(Number(link.id))}
                              disabled={isRemovingLink === link.id}
                              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger-color)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                              title="Remove link"
                            >
                              {isRemovingLink === link.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-col gap-2 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Add New Link</p>
                      <div className="flex gap-2">
                        <select
                          className="text-xs px-2 py-1.5 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                          value={selectedLinkType}
                          onChange={e => setSelectedLinkType(e.target.value as LinkType)}
                        >
                          <option value="relates_to">Relates to</option>
                          <option value="blocks">Blocks</option>
                          <option value="is_blocked_by">Is blocked by</option>
                          <option value="duplicates">Duplicates</option>
                          <option value="is_duplicated_by">Is duplicated by</option>
                        </select>
                        <div className="flex-1 relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                          <input
                            type="text"
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                            placeholder="Search task by title or ID..."
                            value={linkSearchQuery}
                            onChange={e => setLinkSearchQuery(e.target.value)}
                          />
                          
                          {linkSearchQuery.trim() && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                              {tasks
                                .filter(t => 
                                  t.id !== editingTask.id && 
                                  (t.title.toLowerCase().includes(linkSearchQuery.toLowerCase()) || 
                                   t.display_id?.toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
                                   t.id.toString().includes(linkSearchQuery))
                                )
                                .slice(0, 5)
                                .map(t => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => handleAddLink(t.id)}
                                    disabled={isLinkingTask}
                                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-secondary)] text-xs border-b border-[var(--border-color)] last:border-0 disabled:opacity-50"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-[var(--text-primary)] truncate mr-2">
                                        <span className="text-[var(--text-muted)] mr-1">#{t.display_id || `IC-${t.id}`}</span>
                                        {t.title}
                                      </span>
                                      <span className="text-[10px] text-[var(--text-muted)] shrink-0">{t.status}</span>
                                    </div>
                                  </button>
                                ))}
                              {tasks.filter(t => 
                                t.id !== editingTask.id && 
                                (t.title.toLowerCase().includes(linkSearchQuery.toLowerCase()) || 
                                 t.display_id?.toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
                                 t.id.toString().includes(linkSearchQuery))
                              ).length === 0 && (
                                <div className="px-3 py-2 text-xs text-[var(--text-muted)] italic">No tasks found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity Log Section */}
                {editingTask && (
                  <div className="pt-6 border-t border-[var(--border-color)]">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="w-4 h-4 text-[var(--text-secondary)]" />
                      <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase">Activity Log</h4>
                    </div>

                    <div className="space-y-4">
                      {activities.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)] italic">No activity recorded yet.</p>
                      ) : (
                        <div className="relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-color)]">
                          {activities.map((activity) => (
                            <div key={activity.id} className="relative pl-10 pb-6 last:pb-0">
                              <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center z-10">
                                <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-bold text-[var(--text-primary)]">{activity.user}</span>
                                  <span className="text-xs text-[var(--text-muted)]">{activity.action}</span>
                                </div>
                                {activity.details && (
                                  <div className="text-xs text-[var(--text-secondary)] mb-1">
                                    {activity.details.includes('<') && activity.details.includes('>') ? (
                                      <div 
                                        className="[&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_*]:text-inherit [&_*]:text-[12px] w-full"
                                        dangerouslySetInnerHTML={{ __html: activity.details }}
                                      />
                                    ) : (
                                      activity.details
                                    )}
                                  </div>
                                )}
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  {formatDateTime(activity.created_at)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>

              <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-secondary)] transition-colors duration-200">
                <button 
                  type="button"
                  onClick={closeModal}
                  disabled={isSavingTask}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] rounded transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="task-form"
                  disabled={isSavingTask}
                  className="px-4 py-2 btn-primary text-sm font-medium rounded transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingTask ? 'Save changes' : 'Create issue'}
                </button>
              </div>

              {/* Save as Template Popover */}
              {!editingTask && (
                <div className="px-6 py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
                  {showTemplateSave ? (
                    <div className="flex items-center gap-2 w-full">
                      <input 
                        type="text"
                        placeholder="Template Name"
                        className="flex-1 px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)]"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                      />
                      <button 
                        onClick={handleSaveTemplate}
                        disabled={isSavingTemplate || !templateName.trim()}
                        className="px-3 py-1 bg-[var(--success-color)] hover:bg-[var(--success-color)] text-[var(--text-on-accent)] text-xs font-bold rounded disabled:opacity-50"
                      >
                        {isSavingTemplate ? 'Saving...' : 'Save'}
                      </button>
                      <button 
                        onClick={() => setShowTemplateSave(false)}
                        disabled={isSavingTemplate}
                        className="px-3 py-1 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] text-xs font-bold rounded disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowTemplateSave(true)}
                      className="text-xs font-bold text-[var(--success-color)] hover:text-[var(--success-color)] flex items-center gap-1.5"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Save as Template
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
