import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { auth, signInWithGoogle } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

function Root() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize theme early to prevent flash of wrong colors and fix CSS variables
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-body)]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-color)]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-body)] p-4 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--accent-color)] opacity-[0.05] blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--accent-color)] opacity-[0.05] blur-3xl pointer-events-none"></div>
        
        <div className="bg-[var(--bg-surface)] p-10 rounded-2xl shadow-xl text-center max-w-md w-full border border-[var(--border-color)] relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-[var(--accent-color)] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-[var(--accent-color)]/20">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white">
              <rect width="24" height="24" rx="4" fill="currentColor" />
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="sans-serif" letterSpacing="0.5">IC</text>
            </svg>
          </div>
          
          <h1 className="text-3xl font-extrabold mb-3 text-[var(--text-primary)] tracking-tight">IC Task Manager</h1>
          <p className="mb-8 text-[var(--text-secondary)] text-sm max-w-[250px] leading-relaxed">
            Welcome back. Please sign in to access your workspace and manage your tasks.
          </p>
          
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-3 rounded-xl hover:bg-[var(--bg-secondary)] hover:border-[var(--border-focus)] font-semibold transition-all duration-200 flex items-center justify-center gap-3 shadow-sm group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          
          <div className="mt-8 text-xs text-[var(--text-muted)]">
            Secure access via Google Workspace
          </div>
        </div>
      </div>
    );
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
