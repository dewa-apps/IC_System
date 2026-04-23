import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { User, Bell, Palette, Users, Trash2, Edit2, Plus, Loader2, Database, AlertTriangle } from 'lucide-react';
import { User as AppUser, Task } from '../types';
import { apiFetch } from '../apiInterceptor';
import toast from 'react-hot-toast';

interface SettingsViewProps {
  users: AppUser[];
  currentUserRole: 'admin' | 'user';
  onUsersChange: () => void;
  theme?: 'light' | 'dark' | 'system';
  setTheme?: (theme: 'light' | 'dark' | 'system') => void;
  notificationConfig?: { email: boolean; inApp: boolean };
  updateNotificationConfig?: (key: 'email' | 'inApp', value: boolean) => void;
  backupConfig: { enabled: boolean; intervalMinutes: number };
  updateBackupConfig: (config: { enabled: boolean; intervalMinutes: number }) => void;
}

export default function SettingsView({ 
  users, 
  currentUserRole, 
  onUsersChange,
  theme = 'system',
  setTheme,
  notificationConfig = { email: true, inApp: true },
  updateNotificationConfig,
  backupConfig,
  updateBackupConfig
}: SettingsViewProps) {
  const currentUser = auth.currentUser;
  const [activeTab, setActiveTab] = useState('profile');
  
  // User Management State
  const [isEditingUser, setIsEditingUser] = useState<AppUser | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({ name: '', email: '', role: 'user' as 'admin' | 'user' });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [deduplicateData, setDeduplicateData] = useState<{toDeleteIds: string[], displaySize: number} | null>(null);

  const checkDeduplicate = async () => {
    try {
        setIsDeduplicating(true);
        // Fetch all recent tasks
        const res = await apiFetch('/api/tasks?limit=5000');
        const allTasks: Task[] = await res.json();
        
        const mapDisplayIdToTasks = new Map<string, Task[]>();
        allTasks.forEach((t) => {
            if (t.display_id) {
                if (!mapDisplayIdToTasks.has(t.display_id)) mapDisplayIdToTasks.set(t.display_id, []);
                mapDisplayIdToTasks.get(t.display_id)!.push(t);
            }
        });
        
        const toDeleteIds: string[] = [];
        
        mapDisplayIdToTasks.forEach((tasksList) => {
            if (tasksList.length > 1) {
                // Sort by created_at desc (newest first)
                tasksList.sort((a, b) => {
                  const dateB = typeof b.created_at === 'string' || typeof b.created_at === 'number' ? new Date(b.created_at as any).getTime() : 0;
                  const dateA = typeof a.created_at === 'string' || typeof a.created_at === 'number' ? new Date(a.created_at as any).getTime() : 0;
                  return dateB - dateA;
                });
                // Keep the first (newest), delete the rest
                tasksList.slice(1).forEach(t => toDeleteIds.push(t.id as string));
            }
        });
        
        if (toDeleteIds.length === 0) {
            toast.success('Database is clean. No duplicates found.');
            setIsDeduplicating(false);
            return;
        }
        
        setDeduplicateData({ toDeleteIds, displaySize: mapDisplayIdToTasks.size });
    } catch (err) {
        console.error(err);
        toast.error('An error occurred during deduplication scan.');
        setIsDeduplicating(false);
    }
  };

  const executeDeduplicate = async () => {
    if (!deduplicateData) return;
    try {
        let deletedCount = 0;
        for (const id of deduplicateData.toDeleteIds) {
            const delRes = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
            if (delRes.ok) deletedCount++;
        }
        
        toast.success(`Deduplication complete. Deleted ${deletedCount} older duplicate tasks.`);
        if (typeof window !== 'undefined') window.location.reload();
    } catch (err) {
        console.error(err);
        toast.error('An error occurred during deduplication deletion.');
    } finally {
        setIsDeduplicating(false);
        setDeduplicateData(null);
    }
  };

  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [clearOptions, setClearOptions] = useState({
    readNotifications: true,
    oldActivityLogs: true
  });

  const executeClearLogs = async () => {
    try {
        setIsClearingLogs(true);
        let deletedCount = 0;
        
        if (clearOptions.oldActivityLogs) {
            // Identify old tasks that are completed/closed
            const res = await apiFetch('/api/tasks?limit=5000');
            const allTasks: Task[] = await res.json();
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const targetTaskIds = new Set(
                allTasks
                    .filter(t => {
                        if (t.status !== 'DONE' && t.status !== 'CLOSED') return false;
                        const created = typeof t.created_at === 'string' || typeof t.created_at === 'number' 
                          ? new Date(t.created_at as any) 
                          : new Date();
                        return created < oneYearAgo;
                    })
                    .map(t => t.id)
            );

            // Fetch and loop to delete activity_log
            const activityQ = await getDocs(collection(db, 'activity_log'));
            for (const actDoc of activityQ.docs) {
                const data = actDoc.data();
                if (data.task_id && targetTaskIds.has(data.task_id)) {
                    await deleteDoc(doc(db, 'activity_log', actDoc.id));
                    deletedCount++;
                }
            }
        }

        if (clearOptions.readNotifications) {
            // Fetch and loop to delete notifications
            const notifQ = await getDocs(collection(db, 'notifications'));
            for (const notifDoc of notifQ.docs) {
                const data = notifDoc.data();
                if (data.read === true) {
                    await deleteDoc(doc(db, 'notifications', notifDoc.id));
                    deletedCount++;
                }
            }
        }

        toast.success(`Successfully deleted ${deletedCount} logs and notifications.`);
    } catch (err) {
        console.error(err);
        toast.error('An error occurred during log clearing.');
    } finally {
        setIsClearingLogs(false);
        setShowClearLogsConfirm(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUser(true);
    try {
      const url = isEditingUser ? `/api/users/${isEditingUser.id}` : '/api/users';
      const method = isEditingUser ? 'PUT' : 'POST';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData)
      });
      
      if (res.ok) {
        setIsEditingUser(null);
        setIsAddingUser(false);
        setUserFormData({ name: '', email: '', role: 'user' });
        onUsersChange();
        toast.success(isEditingUser ? 'User updated successfully' : 'User added successfully');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save user');
      }
    } catch (err) {
      console.error('Failed to save user:', err);
      toast.error('Failed to save user');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsDeletingUser(userId);
    try {
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUserToDelete(null);
        onUsersChange();
        toast.success('User deleted successfully');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error('Failed to delete user');
    } finally {
      setIsDeletingUser(null);
    }
  };

  return (
    <main className="flex-1 p-6 overflow-auto bg-[var(--bg-body)]">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Settings</h1>
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Settings Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'profile' 
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'appearance' 
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Palette className="w-4 h-4" />
                Appearance
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'notifications' 
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Bell className="w-4 h-4" />
                Notifications
              </button>
              {currentUserRole === 'admin' && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'users' 
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  User Management
                </button>
              )}
              {currentUserRole === 'admin' && (
                <button
                  onClick={() => setActiveTab('data')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'data' 
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  Data Management
                </button>
              )}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="flex-1 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-color)] p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Profile Information</h2>
                  <p className="text-sm text-[var(--text-muted)]">Manage your account details and preferences.</p>
                </div>
                
                <div className="flex items-center gap-6 pb-6 border-b border-[var(--border-color)]">
                  {currentUser?.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt="Profile" 
                      className="w-20 h-20 rounded-full object-cover border border-[var(--border-color)]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold">
                      {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">{currentUser?.displayName || 'Unknown User'}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">{currentUser?.email}</p>
                    <span className="inline-block mt-2 px-2 py-1 badge-accent text-xs font-bold rounded uppercase">
                      {currentUserRole}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Display Name</label>
                    <input 
                      type="text" 
                      disabled
                      value={currentUser?.displayName || ''} 
                      className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-body)] text-[var(--text-primary)] rounded-md opacity-70 cursor-not-allowed"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-1">Managed by your Google Account.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email Address</label>
                    <input 
                      type="email" 
                      disabled
                      value={currentUser?.email || ''} 
                      className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-body)] text-[var(--text-primary)] rounded-md opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Appearance</h2>
                  <p className="text-sm text-[var(--text-muted)]">Customize how the application looks.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-[var(--border-color)] rounded-lg">
                    <div>
                      <h3 className="font-medium text-[var(--text-primary)]">Theme Preference</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Choose your preferred theme.</p>
                    </div>
                    <select 
                      className="px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-body)] text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={theme}
                      onChange={(e) => setTheme?.(e.target.value as 'light' | 'dark' | 'system')}
                    >
                      <option value="system">System Default</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Notifications</h2>
                  <p className="text-sm text-[var(--text-muted)]">Manage how you receive alerts.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-[var(--border-color)] rounded-lg">
                    <div>
                      <h3 className="font-medium text-[var(--text-primary)]">Email Notifications</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Receive updates via email.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={notificationConfig.email}
                        onChange={(e) => updateNotificationConfig?.('email', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-[var(--border-color)] rounded-lg">
                    <div>
                      <h3 className="font-medium text-[var(--text-primary)]">Task Assignments</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Notify when a task is assigned to you.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={notificationConfig.inApp}
                        onChange={(e) => updateNotificationConfig?.('inApp', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && currentUserRole === 'admin' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">User Management</h2>
                    <p className="text-sm text-[var(--text-muted)]">Add, edit, or remove users who can access the application.</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsAddingUser(true);
                      setIsEditingUser(null);
                      setUserFormData({ name: '', email: '', role: 'user' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add User
                  </button>
                </div>

                {(isAddingUser || isEditingUser) && (
                  <form onSubmit={handleSaveUser} className="p-4 border border-[var(--border-color)] rounded-lg bg-[var(--bg-body)] space-y-4">
                    <h3 className="font-bold text-[var(--text-primary)]">{isEditingUser ? 'Edit User' : 'Add New User'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Name</label>
                        <input
                          type="text"
                          required
                          value={userFormData.name}
                          onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={userFormData.email}
                          onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Role</label>
                        <select
                          value={userFormData.role}
                          onChange={e => setUserFormData({ ...userFormData, role: e.target.value as 'admin' | 'user' })}
                          className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingUser(false);
                          setIsEditingUser(null);
                        }}
                        className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingUser}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                      >
                        {isSavingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save User
                      </button>
                    </div>
                  </form>
                )}

                <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-body)] border-b border-[var(--border-color)]">
                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Role</th>
                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-[var(--bg-body)] transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{user.name}</td>
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{user.email}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              user.role === 'admin' 
                                ? 'badge-purple' 
                                : 'badge-neutral'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {userToDelete === user.id ? (
                                <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 rounded-md p-0.5 border border-red-200 dark:border-red-800">
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={isDeletingUser === user.id}
                                    className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isDeletingUser === user.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Yes
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setUserToDelete(null)}
                                    disabled={isDeletingUser === user.id}
                                    className="text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setIsEditingUser(user);
                                      setIsAddingUser(false);
                                      setUserFormData({ name: user.name, email: user.email, role: user.role });
                                    }}
                                    className="p-1.5 text-[var(--text-secondary)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                    title="Edit User"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setUserToDelete(user.id)}
                                    disabled={isDeletingUser === user.id || user.email === currentUser?.email}
                                    className="p-1.5 text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                    title={user.email === currentUser?.email ? "Cannot delete yourself" : "Delete User"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] italic">
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'data' && currentUserRole === 'admin' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Data Management</h2>
                  <p className="text-sm text-[var(--text-muted)]">Manage your workspace data and run advanced clean up tasks.</p>
                </div>
                
                <div className="p-5 border border-[var(--border-color)] bg-[var(--bg-secondary)] rounded-lg">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 mt-1 text-[var(--text-secondary)]">
                      <Database className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-[var(--text-primary)]">Automated Backup to Google Sheets</h3>
                      <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">
                        Automatically export your entire task database to Google Sheets periodically. You must keep the application open in your browser to process these backups.
                      </p>
                      
                      <div className="flex items-center gap-4 mb-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={backupConfig.enabled}
                            onChange={(e) => updateBackupConfig({ ...backupConfig, enabled: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {backupConfig.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      {backupConfig.enabled && (
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-[var(--text-primary)] font-medium">Backup Interval:</label>
                          <select 
                            value={backupConfig.intervalMinutes}
                            onChange={(e) => updateBackupConfig({ ...backupConfig, intervalMinutes: parseInt(e.target.value) })}
                            className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block px-3 py-1.5"
                          >
                            <option value={5}>Every 5 minutes</option>
                            <option value={15}>Every 15 minutes</option>
                            <option value={30}>Every 30 minutes</option>
                            <option value={60}>Every 1 hour</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-lg">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 mt-1 text-red-600 dark:text-red-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-red-800 dark:text-red-300">Clean Duplicate Tasks</h3>
                      <p className="text-sm text-red-700/80 dark:text-red-300/80 mt-1 mb-4">
                        This action will scan all tasks in the database and group them by their Task ID (e.g., IC-00001). 
                        If multiples are found, it permanently deletes the older copies and only retains the newest one.
                        This cannot be undone.
                      </p>
                      
                      <button 
                        onClick={checkDeduplicate}
                        disabled={isDeduplicating}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded shadow-sm disabled:opacity-50 transition-colors"
                      >
                        {isDeduplicating && !deduplicateData ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Scanning Database...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Start Clean Up
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-lg">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 mt-1 text-red-600 dark:text-red-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-red-800 dark:text-red-300">Clear Logs & Notifications</h3>
                      <p className="text-sm text-red-700/80 dark:text-red-300/80 mt-1 mb-4">
                        This action will permanently delete all activity logs and notifications from your database.
                        This is useful for clearing out spam after performing bulk migrations. This cannot be undone.
                      </p>
                      
                      <button 
                        onClick={() => setShowClearLogsConfirm(true)}
                        disabled={isClearingLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded shadow-sm disabled:opacity-50 transition-colors"
                      >
                        {isClearingLogs ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Deleting Logs...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Clear All Logs
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Deduplication Confirmation Modal */}
            {deduplicateData && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-[var(--bg-surface)] rounded-lg shadow-xl max-w-md w-full p-6 border border-[var(--border-color)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Confirm Deduplication</h3>
                  </div>
                  <p className="text-[var(--text-secondary)] mb-6">
                    Found <span className="font-bold text-[var(--text-primary)]">{deduplicateData.toDeleteIds.length}</span> duplicate tasks over <span className="font-bold text-[var(--text-primary)]">{deduplicateData.displaySize}</span> unique Task IDs.
                    <br /><br />
                    Do you want to permanently delete the older duplicates and keep only the latest version of each task? This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setDeduplicateData(null);
                        setIsDeduplicating(false);
                      }}
                      className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeDeduplicate}
                      disabled={isDeduplicating}
                      className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors flex items-center gap-2"
                    >
                      {isDeduplicating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : 'Delete Duplicates'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Clear Logs Confirmation Modal */}
            {showClearLogsConfirm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-[var(--bg-surface)] rounded-lg shadow-xl max-w-md w-full p-6 border border-[var(--border-color)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Clean Up Old Logs</h3>
                  </div>
                  
                  <p className="text-[var(--text-secondary)] mb-4 text-sm">
                    Select exactly what you want to delete. This action is permanent and cannot be undone.
                  </p>

                  <div className="space-y-3 mb-6 bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)]">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="mt-1 w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-600"
                        checked={clearOptions.readNotifications}
                        onChange={(e) => setClearOptions(prev => ({...prev, readNotifications: e.target.checked}))}
                      />
                      <div>
                        <span className="block text-sm font-medium text-[var(--text-primary)]">Read Notifications</span>
                        <span className="block text-xs text-[var(--text-muted)]">Only delete notifications that have already been marked as read.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="mt-1 w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-600"
                        checked={clearOptions.oldActivityLogs}
                        onChange={(e) => setClearOptions(prev => ({...prev, oldActivityLogs: e.target.checked}))}
                      />
                      <div>
                        <span className="block text-sm font-medium text-[var(--text-primary)]">Old Activity Logs</span>
                        <span className="block text-xs text-[var(--text-muted)]">Only delete activity logs for tasks that are DONE/CLOSED and created &gt; 1 year ago.</span>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowClearLogsConfirm(false)}
                      className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeClearLogs}
                      disabled={isClearingLogs || (!clearOptions.readNotifications && !clearOptions.oldActivityLogs)}
                      className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClearingLogs ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
