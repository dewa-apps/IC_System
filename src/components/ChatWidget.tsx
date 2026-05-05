import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User as UserIcon, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Chat } from '@google/genai';
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
      { role: 'model', text: `Hi ${currentUser.split('@')[0]}! I am the IC System Assistant. You can ask me anything about Tasks, Jadwal, Klaim, Links, or Warehouse data.` }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const isTypingRef = useRef(false);
  const isDragging = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages, CHAT_STORAGE_KEY]);

  const initChat = () => {
    if (chatSessionRef.current) return chatSessionRef.current;
    
    // Initialize Google Gen AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Create system prompt with context data
    const systemPrompt = `You are an AI Assistant for the IC System application.
The user's email is: ${currentUser}. You can address them by their first name if appropriate.
You have access to the following application data. Please use this data to answer user questions factually.

Here is the data, represented as JSON arrays:
- Tasks: ${JSON.stringify(tasks.map(t => ({ id: t.display_id, title: t.title, status: t.status, priority: t.priority, assignee: t.assignee, due_date: t.due_date })))}
- Jadwal: ${JSON.stringify(dataJadwal)}
- Klaim: ${JSON.stringify(dataKlaim)}
- Links: ${JSON.stringify(dataLinks)}
- Warehouse: ${JSON.stringify(dataWarehouse)}

If the user asks a question about schedules (jadwal) this month, look at the Jadwal data.
If asked about tasks, look at the Tasks data.
Be concise and helpful. Format your response in Markdown.`;

    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2
      }
    });

    // Load history into chat session so it retains context
    if (messages.length > 1) {
       chat.history = messages.map(m => ({
         role: m.role,
         parts: [{ text: m.text }]
       }));
    }

    chatSessionRef.current = chat;
    return chat;
  };

  const handleClearHistory = () => {
    const defaultMsg = [{ role: 'model', text: `Hi ${currentUser.split('@')[0]}! I am the IC System Assistant. You can ask me anything about Tasks, Jadwal, Klaim, Links, or Warehouse data.` } as Message];
    setMessages(defaultMsg);
    chatSessionRef.current = null; // force re-init
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      const chat = initChat();
      const response = await chat.sendMessageStream({ message: userMessage });
      
      let fullResponse = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].text = fullResponse;
            return newMsgs;
          });
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Error: Could not process your request at the moment.' }]);
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
          setTimeout(() => { isDragging.current = false; }, 100);
        }}
        onClick={(e) => {
          if (!isDragging.current) setIsOpen(true);
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
                        <div className="text-sm markdown-body prose dark:prose-invert max-w-none">
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
