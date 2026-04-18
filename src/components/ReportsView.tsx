import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { CheckCircle2, Clock, AlertCircle, ListTodo, User, CircleDashed, Calendar, Download } from 'lucide-react';

interface ReportsViewProps {
  tasks: Task[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export default function ReportsView({ tasks }: ReportsViewProps) {
  const [dateFilter, setDateFilter] = useState<string>('thisYear');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredTasks = useMemo(() => {
    if (dateFilter === 'all') return tasks;

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

    return tasks.filter(t => {
      if (!t.created_at) return true; // Include tasks without creation date if any
      const taskDate = new Date(t.created_at);
      return taskDate >= start && taskDate <= end;
    });
  }, [tasks, dateFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const todo = filteredTasks.filter(t => t.status === 'TODO').length;
    const completed = filteredTasks.filter(t => t.status === 'DONE' || t.status === 'CLOSED').length;
    const inProgress = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const unassigned = filteredTasks.filter(t => !t.assignee).length;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const overdue = filteredTasks.filter(t => {
      if (!t.due_date || t.status === 'DONE' || t.status === 'CLOSED') return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < now;
    }).length;

    return { total, todo, completed, inProgress, unassigned, overdue };
  }, [filteredTasks]);

  const statusData = useMemo(() => {
    const counts = filteredTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace('_', ' '),
      value
    }));
  }, [filteredTasks]);

  const priorityData = useMemo(() => {
    const counts = filteredTasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value
    }));
  }, [filteredTasks]);

  const assigneeData = useMemo(() => {
    const counts = filteredTasks.reduce((acc, task) => {
      const assignee = task.assignee || 'Unassigned';
      acc[assignee] = (acc[assignee] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 assignees
  }, [filteredTasks]);

  const handleExportDataWrapper = () => {
    const headers = ['Task ID', 'Title', 'Description', 'Status', 'Priority', 'Assignee', 'Category', 'Brand', 'Request Date', 'Due Date', 'Created At'];
    
    const stripHtml = (html: string) => {
      if (!html) return '';
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    };

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
    link.setAttribute('download', `analytics_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="flex-1 p-6 overflow-auto bg-[var(--bg-body)]">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Reports & Analytics</h2>
        <div className="flex flex-wrap items-center gap-2">
          
          <button 
            onClick={handleExportDataWrapper}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)] transition-colors"
            title="Export analytics to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <div className="flex items-center gap-2 bg-[var(--bg-secondary)] p-1 rounded-md border border-[var(--border-color)]">
            <Calendar className="w-4 h-4 text-[var(--text-secondary)] ml-2" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
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
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-sm px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
              <span className="text-[var(--text-secondary)]">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-sm px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <ListTodo className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">Total Tasks</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 shrink-0">
            <CircleDashed className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">To Do</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.todo}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">In Progress</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.inProgress}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">Completed</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.completed}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">Unassigned</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.unassigned}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">Overdue</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.overdue}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Chart */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6">Tasks by Status</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Chart */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6">Tasks by Priority</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'var(--bg-secondary)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assignee Chart */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6">Tasks by Assignee (Top 10)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assigneeData} layout="vertical" margin={{ left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  cursor={{ fill: 'var(--bg-secondary)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {assigneeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
