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
  assignee?: string;
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
  comment_count?: number;
  attachment_count?: number;
  recurring_pattern?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export interface DataListJadwal {
  id: string;
  display_id?: string;
  date: string;
  type: string;
  category: string;
  wh_code: string;
  wh_name: string;
  wh_partner: string;
  remark: string;
  subject_email: string;
  status_btb_wh: 'None' | 'Open' | 'In Progress' | 'Done';
  subject_email_btb_brand: string;
  status_btb_brand: 'None' | 'Open' | 'In Progress' | 'Done';
  created_at?: any;
  updated_at?: any;
}

export interface DataListLink {
  id: string;
  display_id?: number | string; // Optionally we can use a sequence or just use document ID
  category: string;
  link_name: string;
  link_url: string;
  description: string;
  note: string;
  created_at?: string;
  updated_at?: string;
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
