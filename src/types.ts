export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Comment {
  id: string | number;
  task_id: string | number;
  author: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface Attachment {
  id: string | number;
  task_id: string | number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
  url?: string;
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string;
}

export interface Template {
  id: string | number;
  name: string;
  description: string;
  category: string;
  brand: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subtasks: { title: string }[];
}

export interface ActivityLog {
  id: string | number;
  task_id: string | number;
  user: string;
  action: string;
  details: string;
  created_at: string;
}

export interface Task {
  id: string | number;
  display_id?: string;
  task_number?: number;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignee: string;
  request_date: string;
  due_date: string;
  category: string;
  brand: string;
  requestor: string;
  division: string;
  created_at: string;
  authorName?: string;
  subtasks?: SubTask[];
}

export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];

export type LinkType = 'blocks' | 'is_blocked_by' | 'relates_to' | 'duplicates' | 'is_duplicated_by';

export interface TaskLink {
  id: string | number;
  source_task_id: string | number;
  target_task_id: string | number;
  link_type: LinkType;
  created_at: string;
  target_task_title?: string;
  target_task_status?: TaskStatus;
  target_task_display_id?: string;
}
