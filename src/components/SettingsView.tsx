import React, { useState } from 'react';
import { auth } from '../firebase';
import { User, Bell, Palette, Users, Trash2, Edit2, Plus, Loader2 } from 'lucide-react';
import { User as AppUser } from '../types';
import { apiFetch } from '../apiInterceptor';

interface SettingsViewProps {
  users: AppUser[];
  currentUserRole: 'admin' | 'user';
  onUsersChange: () => void;
}

export default function SettingsView({ users, currentUserRole, onUsersChange }: SettingsViewProps) {
  const currentUser = auth.currentUser;
  const [activeTab, setActiveTab] = useState('profile');
  
  // User Management State
  const [isEditingUser, setIsEditingUser] = useState<AppUser | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({ name: '', email: '', role: 'user' as 'admin' | 'user' });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);

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
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save user');
      }
    } catch (err) {
      console.error('Failed to save user:', err);
      alert('Failed to save user');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setIsDeletingUser(userId);
    try {
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        onUsersChange();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user');
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
                    <select className="px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-body)] text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-[var(--border-color)] rounded-lg">
                    <div>
                      <h3 className="font-medium text-[var(--text-primary)]">Task Assignments</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Notify when a task is assigned to you.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
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
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={isDeletingUser === user.id || user.email === currentUser?.email}
                                className="p-1.5 text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                title={user.email === currentUser?.email ? "Cannot delete yourself" : "Delete User"}
                              >
                                {isDeletingUser === user.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
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
          </div>
        </div>
      </div>
    </main>
  );
}
