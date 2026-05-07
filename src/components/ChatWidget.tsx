import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User as UserIcon, Loader2, Trash2, CloudDownload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Task, DataListLink, DataListJadwal, DataListKlaim } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ChatWidgetProps {
  tasks: Task[];
  dataJadwal: DataListJadwal[];
  dataKlaim: DataListKlaim[];
  dataLinks: DataListLink[];
  dataWarehouse: any[];
  currentUser: string;
}

export default function ChatWidget({ tasks, dataJadwal, dataKlaim, dataLinks, dataWarehouse, currentUser }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const CHAT_STORAGE_KEY = `ic_system_chat_hx_${currentUser}`;
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to parse chat history");
      }
    }
    return [
      { role: 'model', text: `Hi ${currentUser ? String(currentUser).split('@')[0] : 'User'}! Saya ICAI, kamu bisa menanyakan apapun tentang Tasks, Jadwal, Kalim, Link atau Warehouse data. Tapi saya tidak bisa menerjemahkan Bahasa GOKU.` }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [driveData, setDriveData] = useState<any[]>([]);
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);
  const isTypingRef = useRef(false);
  const isDragging = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages, CHAT_STORAGE_KEY]);

  const handleClearHistory = () => {
    const defaultMsg = [{ role: 'model', text: `Hi ${currentUser ? String(currentUser).split('@')[0] : 'User'}! Saya ICAI, kamu bisa menanyakan apapun tentang Tasks, Jadwal, Kalim, Link atau Warehouse data. Tapi saya tidak bisa menerjemahkan Bahasa GOKU .` } as Message];
    setMessages(defaultMsg);
  };

  const handleFetchDriveInfo = async () => {
    setIsFetchingDrive(true);
    try {
      const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
      const payload = {
        action: 'getDriveFolderText',
        folderId: '1fmZcQre4WqR6o-K5mJVwTtTgjiNX8MlM'
      };

      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Prevent CORS preflight for GAS
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      
      if (resData.status === 'success') {
        setDriveData(resData.data);
        setMessages(prev => [...prev, { role: 'model', text: `✅ Berhasil mengekstrak ${resData.data.length} dokumen dari folder Drive untuk referensi tambahan.` }]);
      } else {
        throw new Error(resData.message || 'Unknown error');
      }
    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: `❌ Gagal menarik referensi folder Drive: ${e.message}` }]);
    }
    setIsFetchingDrive(false);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      const simplifiedHistory = messages.length > 1 ? messages.slice(1) : [];
      
      const payload = {
        message: userMessage,
        history: simplifiedHistory,
        currentUser,
        contextData: {
          tasks: tasks.map(t => ({ id: t.display_id, title: t.title, status: t.status, priority: t.priority, assignee: t.assignee, due_date: t.due_date })),
          jadwal: dataJadwal,
          klaim: dataKlaim,
          links: dataLinks,
          warehouse: dataWarehouse,
          driveData: driveData
        }
      };

      let apiUrl = '/api/chat';
      if (import.meta.env.VITE_API_URL) {
        apiUrl = `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/chat`;
      } else if (window.location.hostname.includes('github.io')) {
        apiUrl = 'https://ic-system.vercel.app/api/chat';
      }

      let response;
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch (err: any) {
        throw new Error("Unable to reach the backend (/api/chat). Please ensure your environment is running the backend correctly.");
      }

      if (!response.ok) {
        let errMessage = `HTTP error! status: ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) errMessage = errData.error;
        } catch(e) {}
        throw new Error(errMessage);
      }

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const textChunk = decoder.decode(value, { stream: true });
        if (textChunk) {
          fullResponse += textChunk;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].text = fullResponse;
            return newMsgs;
          });
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessage = error?.message || 'Could not process your request at the moment.';
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${errorMessage}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <motion.button
        drag
        dragMomentum={false}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={() => { 
          setTimeout(() => { isDragging.current = false; }, 200);
        }}
        onClick={(e) => {
          if (isDragging.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          setIsOpen(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--accent-color)] text-[var(--text-on-accent)] rounded-full shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-[var(--accent-hover)] transition-colors z-40"
      >
        <MessageSquare className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-80 md:w-96 h-[500px] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-xl flex flex-col overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-[var(--accent-color)] text-[var(--text-on-accent)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <span className="font-semibold">ICAI - AI Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleFetchDriveInfo}
                  disabled={isFetchingDrive}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors flex items-center justify-center relative disabled:cursor-not-allowed"
                  title="Sinkronisasi Data Drive (Referensial AI)"
                >
                  {isFetchingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors flex items-center justify-center group relative"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-body)]">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1">
                      {msg.role === 'user' ? (
                        <div className="bg-[var(--accent-color)] text-white w-full h-full rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] w-full h-full rounded-full flex items-center justify-center text-[var(--text-primary)]">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className={`px-4 py-2 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-[var(--accent-color)] text-[var(--text-on-accent)] rounded-tr-none' 
                        : 'bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-tl-none'
                    }`}>
                      {msg.role === 'user' ? (
                        <p className="text-sm">{msg.text}</p>
                      ) : (
                        <div className="text-sm prose dark:prose-invert max-w-none prose-p:text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] prose-a:text-[var(--accent-color)] prose-li:text-[var(--text-primary)] text-[var(--text-primary)]">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[85%]">
                     <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)]">
                        <Bot className="w-4 h-4" />
                     </div>
                     <div className="px-4 py-2 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-tl-none">
                       <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                     </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-[var(--bg-surface)] border-t border-[var(--border-color)]">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded-full px-4 py-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="p-1.5 bg-[var(--accent-color)] text-[var(--text-on-accent)] rounded-full hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
