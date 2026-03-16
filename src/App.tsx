import React, { useState, useEffect, useCallback } from 'react';
import { 
  Layout, 
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
  File,
  Download,
  Upload,
  FileText,
  List as ListIcon,
  Table as TableIcon
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
  defaultDropAnimationSideEffects,
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
import { Task, TaskStatus, TaskPriority, Comment, Attachment } from './types';

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
          ? 'border-red-200 bg-red-50 hover:border-red-400' 
          : 'bg-white border-transparent hover:border-blue-500'
      }`}
      onClick={() => onClick(task)}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
      
      <p className="text-sm text-[#172B4D] mb-1 leading-tight font-medium pr-6">
        {task.title}
      </p>
      {task.description && (
        <p 
          className="text-[11px] text-[#5E6C84] mb-3 line-clamp-2 leading-normal"
          title={task.description}
        >
          {task.description}
        </p>
      )}
      <div className="flex flex-wrap gap-1 mb-3">
        {task.category && (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
            {task.category}
          </span>
        )}
        {task.brand && (
          <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-medium">
            {task.brand}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getPriorityIcon(task.priority)}
          <span className="text-[10px] font-bold text-[#5E6C84]">IC-{task.id}</span>
        </div>
        <div className="flex items-center gap-3">
          {task.due_date && (
            <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-red-600' : 'text-[#5E6C84]'}`}>
              <Clock className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </div>
          )}
          {task.assignee && (
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm" 
              title={task.assignee}
              style={{ 
                backgroundColor: getAvatarColor(task.assignee).bg,
                color: getAvatarColor(task.assignee).text
              }}
            >
              {getInitials(task.assignee)}
            </div>
          )}
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
  key?: React.Key;
}

function KanbanColumn({ id, label, tasks, onAddTask, onTaskClick, getPriorityIcon, onRenameColumn, onSortTasks }: KanbanColumnProps) {
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
              className="text-xs font-bold text-[#172B4D] uppercase tracking-wider bg-white border border-blue-500 rounded px-1 py-0.5 w-full outline-none"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
        ) : (
          <h2 className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider flex items-center gap-2">
            {label} 
            <span className="bg-[#DFE1E6] px-2 py-0.5 rounded-full text-[10px] text-[#42526E]">{tasks.length}</span>
          </h2>
        )}
        
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-1 rounded transition-colors ${isMenuOpen ? 'bg-[#EBECF0] text-[#172B4D]' : 'text-[#5E6C84] hover:bg-[#EBECF0]'}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-xl border border-[#DFE1E6] z-30 py-1 overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider border-b border-[#DFE1E6] mb-1">
                  Column Actions
                </div>
                <button 
                  onClick={() => {
                    setIsRenaming(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#5E6C84]" />
                  Rename Column
                </button>
                
                <div className="px-3 py-1.5 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider border-y border-[#DFE1E6] my-1">
                  Sort Tasks By
                </div>
                <button 
                  onClick={() => { onSortTasks(id, 'DUE_DATE'); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-[#5E6C84]" />
                  Due Date
                </button>
                <button 
                  onClick={() => { onSortTasks(id, 'PRIORITY'); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-[#5E6C84]" />
                  Priority
                </button>
                <button 
                  onClick={() => { onSortTasks(id, 'CATEGORY'); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2"
                >
                  <Tag className="w-3.5 h-3.5 text-[#5E6C84]" />
                  Category
                </button>
                <button 
                  onClick={() => { onSortTasks(id, 'NEWEST_ID'); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2"
                >
                  <Hash className="w-3.5 h-3.5 text-[#5E6C84]" />
                  Newest ID
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`kanban-column flex-1 overflow-y-auto transition-colors scrollbar-thin scrollbar-thumb-gray-300 ${isOver ? 'bg-[#E2E4E9]' : ''}`}
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
            className="w-full py-2 mt-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-200 transition-colors"
          >
            Show {Math.min(20, tasks.length - displayLimit)} more... ({tasks.length - displayLimit} remaining)
          </button>
        )}
        
        <button 
          onClick={() => onAddTask(id)}
          className="flex items-center gap-2 text-sm text-[#42526E] hover:bg-[#DFE1E6] p-2 rounded transition-colors mt-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create issue
        </button>
      </div>
    </div>
  );
}

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  getPriorityIcon: (priority: TaskPriority) => React.ReactNode;
}

function TaskListView({ tasks, onTaskClick, getPriorityIcon }: TaskListViewProps) {
  return (
    <div className="bg-white border border-[#DFE1E6] rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-[#F4F5F7] border-b border-[#DFE1E6]">
              <th className="px-4 py-3 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider w-24">Key</th>
              <th className="px-4 py-3 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Summary</th>
              <th className="px-4 py-3 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider w-32">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider w-32">Priority</th>
              <th className="px-4 py-3 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider w-40">Assignee</th>
              <th className="px-4 py-3 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider w-32">Due Date</th>
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
                  className={`border-b border-[#DFE1E6] hover:bg-[#F4F5F7] cursor-pointer transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}
                  onClick={() => onTaskClick(task)}
                >
                  <td className="px-4 py-3 text-xs font-bold text-[#5E6C84]">IC-{task.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#172B4D]">{task.title}</span>
                      {task.category && (
                        <span className="text-[10px] text-blue-600 font-medium">{task.category}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-1 bg-[#EBECF0] text-[#42526E] rounded font-bold uppercase whitespace-nowrap">
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(task.priority)}
                      <span className="text-xs text-[#42526E]">{task.priority}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ 
                            backgroundColor: getAvatarColor(task.assignee).bg,
                            color: getAvatarColor(task.assignee).text
                          }}
                        >
                          {getInitials(task.assignee)}
                        </div>
                        <span className="text-xs text-[#42526E] truncate">{task.assignee}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#5E6C84] italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {task.due_date ? (
                      <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600 font-bold' : 'text-[#42526E]'}`}>
                        {isOverdue && <Clock className="w-3 h-3" />}
                        {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                    ) : (
                      <span className="text-xs text-[#5E6C84]">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tasks.length === 0 && (
        <div className="p-12 text-center text-[#5E6C84] italic bg-white">
          No tasks found matching your criteria.
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<{ id: TaskStatus; label: string }[]>([
    { id: 'TODO', label: 'To Do' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'REVIEW', label: 'In Review' },
    { id: 'DONE', label: 'Done' },
    { id: 'CLOSED', label: 'Closed' }
  ]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO' as TaskStatus,
    priority: 'MEDIUM' as TaskPriority,
    assignee: '',
    request_date: new Date().toISOString().split('T')[0],
    due_date: '',
    category: '',
    brand: '',
    requestor: '',
    division: ''
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
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
            await fetch(`/api/tasks/${newTask.id}/attachments`, {
              method: 'POST',
              body: uploadData
            });
          }
        }
        fetchTasks();
        closeModal();
      }
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchTasks();
        closeModal();
      } else {
        console.error('Delete failed');
        alert('Failed to delete task.');
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    } finally {
      setIsDeletingTask(false);
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
        request_date: task.request_date || new Date().toISOString().split('T')[0],
        due_date: task.due_date || '',
        category: task.category || '',
        brand: task.brand || '',
        requestor: task.requestor || '',
        division: task.division || ''
      });
      fetchComments(task.id);
      fetchAttachments(task.id);
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assignee: '',
        request_date: new Date().toISOString().split('T')[0],
        due_date: '',
        category: '',
        brand: '',
        requestor: '',
        division: ''
      });
      setComments([]);
    }
    setIsModalOpen(true);
  };

  const fetchComments = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !editingTask) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: 'John Doe', // In a real app, this would be the logged-in user
          content: newComment
        })
      });

      if (res.ok) {
        setNewComment('');
        fetchComments(editingTask.id);
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Delete this comment?')) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok && editingTask) {
        fetchComments(editingTask.id);
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const fetchAttachments = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`);
      const data = await res.json();
      setAttachments(data);
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!editingTask) {
      setPendingFiles(prev => [...prev, ...Array.from(files)]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        
        const res = await fetch(`/api/tasks/${editingTask.id}/attachments`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) throw new Error('Upload failed');
      }
      fetchAttachments(editingTask.id);
    } catch (err) {
      console.error('Failed to upload file:', err);
      alert('Failed to upload one or more files.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = (attachment: Attachment) => {
    window.open(`/api/attachments/${attachment.id}/download`, '_blank');
  };

  const handleDeleteAttachment = async (id: number) => {
    if (!window.confirm('Delete this attachment?')) return;
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (res.ok && editingTask) {
        fetchAttachments(editingTask.id);
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
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

  const syncTaskStatus = useCallback(async (id: number, newStatus: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) {
        // Rollback on failure
        fetchTasks();
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

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    let finalStatus: TaskStatus | null = null;

    setTasks((prev) => {
      const activeIndex = prev.findIndex((t) => t.id === activeId);
      const overIndex = prev.findIndex((t) => t.id === overId);

      if (activeIndex === -1) return prev;

      const activeTask = prev[activeIndex];
      finalStatus = activeTask.status;

      // Reordering within the same column
      if (overIndex !== -1 && activeId !== overId) {
        const overTask = prev[overIndex];
        if (activeTask.status === overTask.status) {
          return arrayMove(prev, activeIndex, overIndex);
        }
      }

      return prev;
    });

    // Sync with server if status changed
    // We need to know the original status. We can get it from the 'tasks' state 
    // which was captured when handleDragEnd was created for this render.
    const originalTask = tasks.find(t => t.id === activeId);
    
    // Determine the intended new status from the drop target
    let intendedStatus: TaskStatus | null = null;
    if (STATUS_COLUMNS.some(c => c.id === overId)) {
      intendedStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) intendedStatus = overTask.status;
    }

    if (originalTask && intendedStatus && originalTask.status !== intendedStatus) {
      await syncTaskStatus(Number(activeId), intendedStatus);
    }
  }, [tasks, syncTaskStatus]);

  const uniqueAssignees = Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean))) as string[];

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.requestor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAssignee = selectedAssignees.length === 0 || (t.assignee && selectedAssignees.includes(t.assignee));
    
    return matchesSearch && matchesAssignee;
  });

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
            return b.id - a.id;
          default:
            return 0;
        }
      });

      return [...otherTasks, ...sorted];
    });
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'HIGH': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'MEDIUM': return <Circle className="w-4 h-4 text-blue-600" />;
      case 'LOW': return <Circle className="w-4 h-4 text-green-600" />;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F4F5F7]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#DFE1E6] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-1.5 rounded">
            <Layout className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#172B4D]">IC System</h1>
          <nav className="ml-8 hidden lg:flex items-center gap-6 text-sm font-medium text-[#42526E]">
            <button 
              onClick={() => setViewMode('board')}
              className={`pb-4 -mb-4 transition-colors ${viewMode === 'board' ? 'text-blue-600 border-b-2 border-blue-600' : 'hover:text-blue-600'}`}
            >
              Board
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`pb-4 -mb-4 transition-colors ${viewMode === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'hover:text-blue-600'}`}
            >
              List
            </button>
            <a href="#" className="hover:text-blue-600 transition-colors">Backlog</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Reports</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {/* View Toggle (Mobile/Small screens) */}
          <div className="flex lg:hidden items-center bg-[#F4F5F7] p-1 rounded-md border border-[#DFE1E6]">
            <button 
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded transition-all ${viewMode === 'board' ? 'bg-white shadow-sm text-blue-600' : 'text-[#5E6C84]'}`}
              title="Board View"
            >
              <Layout className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-[#5E6C84]'}`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center -space-x-2 mr-2">
            {uniqueAssignees.map((assignee) => {
              const colors = getAvatarColor(assignee);
              const isSelected = selectedAssignees.includes(assignee);
              return (
                <button
                  key={assignee}
                  onClick={() => toggleAssigneeFilter(assignee)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                    isSelected
                      ? 'ring-2 ring-blue-400 scale-110 z-10 border-white'
                      : 'border-white hover:scale-105'
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
            {selectedAssignees.length > 0 && (
              <button 
                onClick={() => setSelectedAssignees([])}
                className="ml-4 text-xs text-blue-600 hover:underline font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#42526E]" />
            <input 
              type="text" 
              placeholder="Search tasks..."
              className="pl-10 pr-4 py-2 bg-[#F4F5F7] border border-[#DFE1E6] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
            style={{ backgroundColor: getAvatarColor('John Doe').bg, color: getAvatarColor('John Doe').text }}
          >
            {getInitials('John Doe')}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-x-auto">
        {viewMode === 'board' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 min-w-max h-full">
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
                    isOverdue ? 'border-red-400 bg-red-50' : 'border-blue-500 bg-white'
                  }`}>
                    <p className="text-sm text-[#172B4D] mb-1 leading-tight font-medium pr-6">
                      {activeTask.title}
                    </p>
                    {activeTask.description && (
                      <p className="text-[11px] text-[#5E6C84] mb-3 line-clamp-2 leading-normal">
                        {activeTask.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {activeTask.category && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                          {activeTask.category}
                        </span>
                      )}
                      {activeTask.brand && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-medium">
                          {activeTask.brand}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(activeTask.priority)}
                        <span className="text-[10px] font-bold text-[#5E6C84]">IC-{activeTask.id}</span>
                      </div>
                    </div>
                  </div>
                );
              })() : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <TaskListView 
            tasks={filteredTasks} 
            onTaskClick={openModal} 
            getPriorityIcon={getPriorityIcon} 
          />
        )}
      </main>

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
              className="relative bg-white w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#172B4D]">
                  {editingTask ? `Edit Issue IC-${editingTask.id}` : 'Create Issue'}
                </h3>
                <div className="flex items-center gap-2">
                  {editingTask && (
                    <div className="flex items-center">
                      {isDeletingTask ? (
                        <div className="flex items-center gap-1 bg-red-50 rounded-md p-1 border border-red-200">
                          <span className="text-[10px] font-bold text-red-600 px-1">Confirm?</span>
                          <button 
                            type="button"
                            onClick={() => handleDelete(editingTask.id)}
                            className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded hover:bg-red-700 transition-colors"
                          >
                            Yes
                          </button>
                          <button 
                            type="button"
                            onClick={() => setIsDeletingTask(false)}
                            className="text-[#5E6C84] text-[10px] font-bold px-2 py-1 rounded hover:bg-[#EBECF0] transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => setIsDeletingTask(true)}
                          className="p-2 text-[#5E6C84] hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  )}
                  <button onClick={closeModal} className="p-2 hover:bg-[#F4F5F7] rounded-md transition-colors">
                    <X className="w-5 h-5 text-[#42526E]" />
                  </button>
                </div>
              </div>

              <form id="task-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Summary</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="What needs to be done?"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Description</label>
                  <textarea 
                    rows={4}
                    className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Add more details..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Request Date</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={formData.request_date}
                      onChange={e => setFormData({ ...formData, request_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Due Date</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={formData.due_date}
                      onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Category</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g. Design, Marketing"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Brand</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.brand}
                      onChange={e => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="e.g. Brand A, Brand B"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Requestor</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.requestor}
                      onChange={e => setFormData({ ...formData, requestor: e.target.value })}
                      placeholder="Who requested this?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Division</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.division}
                      onChange={e => setFormData({ ...formData, division: e.target.value })}
                      placeholder="e.g. Sales, HR"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Status</label>
                    <select 
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    >
                      {columns.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Priority</label>
                    <select 
                      className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                  <label className="block text-xs font-bold text-[#5E6C84] uppercase mb-2">Assignee</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#42526E]" />
                    <input 
                      type="text"
                      className="w-full pl-10 pr-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.assignee}
                      onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                      placeholder="Assign to someone..."
                    />
                  </div>
                </div>

                {/* Attachments Section */}
                <div 
                  className={`mt-8 p-4 border-2 border-dashed rounded-lg transition-colors ${
                    isDragOver ? 'border-blue-500 bg-blue-50' : 'border-[#DFE1E6] bg-[#F4F5F7]'
                  }`}
                  onDragOver={handleDragOverFile}
                  onDragLeave={handleDragLeaveFile}
                  onDrop={handleDropFile}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-[#5E6C84]" />
                      <h4 className="text-xs font-bold text-[#5E6C84] uppercase">Attachments</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50"
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
                          className="flex items-center justify-between p-2 bg-white border border-[#DFE1E6] rounded group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="p-1.5 bg-blue-50 rounded">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-[#172B4D] truncate" title={file.original_name}>
                                {file.original_name}
                              </p>
                              <p className="text-[10px] text-[#5E6C84]">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleDownload(file)}
                              className="p-1.5 text-[#5E6C84] hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(file.id)}
                              className="p-1.5 text-[#5E6C84] hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
                          className="flex items-center justify-between p-2 bg-white border border-blue-200 border-dashed rounded group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="p-1.5 bg-blue-50 rounded">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-[#172B4D] truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-[10px] text-[#5E6C84]">
                                {formatFileSize(file.size)} (Pending)
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePendingFile(index)}
                            className="p-1.5 text-[#5E6C84] hover:text-red-600 hover:bg-red-50 rounded"
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
                      <p className="text-xs text-[#5E6C84]">
                        No attachments yet. Drag and drop files here or click Upload.
                      </p>
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                {editingTask && (
                  <div className="pt-6 border-t border-[#DFE1E6]">
                    <div className="flex items-center gap-2 mb-4">
                      <MessageSquare className="w-4 h-4 text-[#42526E]" />
                      <h4 className="text-xs font-bold text-[#5E6C84] uppercase">Comments</h4>
                    </div>

                    <div className="space-y-4 mb-6">
                      {comments.length === 0 ? (
                        <p className="text-sm text-[#5E6C84] italic">No comments yet.</p>
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
                                  <span className="text-sm font-bold text-[#172B4D]">{comment.author}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-[#5E6C84]">
                                      {new Date(comment.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <button 
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-all"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm text-[#42526E] whitespace-pre-wrap">{comment.content}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: getAvatarColor('John Doe').bg, color: getAvatarColor('John Doe').text }}
                      >
                        {getInitials('John Doe')}
                      </div>
                      <div className="flex-1 relative">
                        <textarea 
                          rows={2}
                          className="w-full px-3 py-2 border border-[#DFE1E6] rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                          placeholder="Add a comment..."
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                        />
                        <button 
                          disabled={isSubmittingComment || !newComment.trim()}
                          onClick={handleAddComment}
                          className="absolute right-2 bottom-2 p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSubmittingComment ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>

              <div className="px-6 py-4 border-t border-[#DFE1E6] flex justify-end gap-3 bg-[#F4F5F7]">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] rounded transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="task-form"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                >
                  {editingTask ? 'Save changes' : 'Create issue'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
