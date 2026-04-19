import React, { useMemo } from 'react';
import { Task, TaskPriority } from '../types';
import { MessageSquare, Paperclip, User } from 'lucide-react';

interface GanttViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  getPriorityIcon: (priority: TaskPriority) => React.ReactNode;
  getAvatarColor: (name: string) => { bg: string; text: string };
  getInitials: (name: string) => string;
}

const DAY_WIDTH = 48; // px

export default function GanttView({ tasks, onTaskClick, getPriorityIcon, getAvatarColor, getInitials }: GanttViewProps) {
  const { processedTasks, minDate, totalDays, dates } = useMemo(() => {
    if (tasks.length === 0) {
      return { processedTasks: [], minDate: new Date(), totalDays: 0, dates: [] };
    }

    const processed = tasks.map(t => {
      const start = new Date(t.request_date || t.created_at || new Date().toISOString());
      let end = new Date(t.due_date || t.request_date || t.created_at || new Date().toISOString());
      
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);

      // If due date is earlier than start date for some reason, enforce start = end
      if (end.getTime() < start.getTime()) {
        end = new Date(start);
      }

      return { task: t, start, end };
    });

    const minTime = Math.min(...processed.map(t => t.start.getTime()));
    const maxTime = Math.max(...processed.map(t => t.end.getTime()));

    let minDate = new Date(minTime);
    minDate.setDate(minDate.getDate() - 3); // pad start by 3 days
    
    let maxDate = new Date(maxTime);
    maxDate.setDate(maxDate.getDate() + 7); // pad end by 7 days

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
    
    const dates = [];
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(minDate);
        d.setDate(minDate.getDate() + i);
        dates.push(d);
    }

    // Sort by start date then priority
    processed.sort((a, b) => {
        if (a.start.getTime() !== b.start.getTime()) {
            return a.start.getTime() - b.start.getTime();
        }
        return 0; // secondary sort could be added
    });

    return { processedTasks: processed, minDate, totalDays, dates };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] italic">
        No tasks to display in Gantt view.
      </div>
    );
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  return (
    <div className="flex-1 overflow-auto bg-[var(--bg-surface)] flex flex-col relative h-full">
      <div className="flex min-w-max">
        {/* Left fixed column: Task names */}
        <div className="w-[300px] shrink-0 sticky left-0 z-20 bg-[var(--bg-surface)] border-r border-[var(--border-color)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] flex flex-col">
          <div className="h-10 border-b border-[var(--border-color)] flex items-center px-4 text-xs font-bold text-[var(--text-muted)] tracking-wider">
            TASK DETAILS
          </div>
          <div className="flex-1 overflow-hidden">
            {processedTasks.map(({ task }, i) => (
              <div 
                key={task.id} 
                className={`h-12 border-b border-[var(--border-color)] flex flex-col justify-center px-4 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors ${i % 2 !== 0 ? 'bg-[var(--bg-primary)]' : ''}`}
                onClick={() => onTaskClick(task)}
              >
                <div className="flex items-center gap-2">
                  <div className="shrink-0">{getPriorityIcon(task.priority)}</div>
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate" title={task.title}>{task.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 opacity-70">
                   <div className="text-[9px] font-mono text-[var(--text-muted)]">{task.display_id || `IC-${task.id}`}</div>
                   {task.assignee && (
                      <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getAvatarColor(task.assignee).bg }} />
                        <span className="truncate max-w-[80px]">{task.assignee}</span>
                      </div>
                   )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right scrollable column: Timeline */}
        <div className="flex-1 flex flex-col relative min-w-max">
          {/* Header Dates */}
          <div className="h-10 flex border-b border-[var(--border-color)] bg-[var(--bg-surface)] sticky top-0 z-10 w-max">
            {dates.map((d, i) => {
              const isTodayMarker = d.getTime() === today.getTime();
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div 
                  key={i} 
                  className={`w-12 shrink-0 flex flex-col items-center justify-center border-r border-[var(--border-color)] ${isTodayMarker ? 'bg-[var(--badge-accent-bg)] border-b-2 border-b-[var(--accent-color)]' : isWeekend ? 'bg-[var(--bg-primary)]' : ''}`}
                >
                  <span className={`text-[9px] uppercase ${isTodayMarker ? 'font-bold text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}`}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className={`text-xs ${isTodayMarker ? 'font-bold text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}>
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Grid Background */}
          <div className="absolute top-10 bottom-0 left-0 right-0 flex pointer-events-none w-max">
             {dates.map((d, i) => {
              const isTodayMarker = d.getTime() === today.getTime();
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div 
                  key={i} 
                  className={`w-12 shrink-0 border-r border-[var(--border-color)] flex items-center justify-center ${isWeekend ? 'bg-[var(--bg-primary)] opacity-50' : ''}`}
                >
                  {isTodayMarker && <div className="w-[1px] h-full bg-[var(--danger-color)] opacity-70" />}
                </div>
              );
            })}
          </div>

          {/* Task Bars */}
          <div className="flex-1 relative w-max">
            {processedTasks.map(({ task, start, end }, i) => {
              const startOffsetDays = (start.getTime() - minDate.getTime()) / (1000 * 3600 * 24);
              const durationDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1; // +1 to inclusive

              const left = startOffsetDays * DAY_WIDTH;
              const width = durationDays * DAY_WIDTH;

              const isDone = task.status === 'DONE' || task.status === 'CLOSED';
              const colorClass = isDone 
                ? 'bg-[var(--success-color)]' 
                : task.status === 'IN_PROGRESS' 
                  ? 'bg-[var(--accent-color)]' 
                  : 'bg-[var(--warning-color)]';

              return (
                <div 
                  key={task.id} 
                  className={`h-12 border-b border-[var(--border-color)] relative group flex items-center px-1 ${i % 2 !== 0 ? 'bg-[var(--bg-primary)]' : ''}`}
                  style={{ width: totalDays * DAY_WIDTH }}
                >
                  <div 
                    className={`absolute h-8 rounded shadow-sm opacity-90 hover:opacity-100 transition-all cursor-pointer flex items-center px-2 overflow-hidden ${colorClass}`}
                    style={{ left, width: Math.max(width, DAY_WIDTH) }}
                    onClick={() => onTaskClick(task)}
                    title={`Start: ${start.toLocaleDateString()}\nDue: ${end.toLocaleDateString()}\nStatus: ${task.status}`}
                  >
                    <span className="text-[10px] font-bold text-white truncate drop-shadow-sm">
                      {task.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
