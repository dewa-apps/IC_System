export interface Comment {
  id: number;
  task_id: number;
  author: string;
  content: string;
  created_at: string;
}

export interface Attachment {
  id: number;
  task_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

export interface Task {
  id: number;
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
}

export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];
