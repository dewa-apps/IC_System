import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'Open': return 'badge-accent';
    case 'In Progress': return 'badge-warning';
    case 'Pending Finance': return 'badge-info';
    case 'Done': return 'badge-success';
    case 'Cancelled': return 'badge-neutral';
    
    // Additional classes for other usage, like Jadwal Statuses
    case 'Ready': return 'badge-info';
    case 'Not Ready': return 'badge-danger';
    
    default: return 'badge-neutral';
  }
};

export const StatusDropdown = ({ 
  value, 
  onChange, 
  disabled, 
  options,
  variant = 'badge',
  className = ''
}: { 
  value: string, 
  onChange: (val: string) => void, 
  disabled?: boolean,
  options: { value: string, label: string }[],
  variant?: 'badge' | 'input',
  className?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number, left: number, width: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
    } else {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 200; 
        const top = spaceBelow < dropdownHeight && rect.top > dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4;
        
        setCoords({ top, left: rect.left, width: Math.max(rect.width, 140) });
      }
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    const handleScroll = () => setIsOpen(false);

    setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }, 10);
    
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const currentOption = options.find(o => o.value === value);

  return (
    <>
      <div 
        ref={buttonRef}
        onClick={toggleDropdown}
        className={variant === 'badge' 
          ? `text-xs font-semibold px-3 py-1 rounded-full cursor-pointer flex items-center justify-between min-w-[90px] border border-[var(--border-color)] hover:opacity-80 transition-opacity ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${getStatusBadgeClass(value)} ${className}`
          : `w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] transition-all cursor-pointer flex items-center justify-between max-h-[38px] ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <div className="flex items-center gap-2">
          {variant === 'input' && <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusBadgeClass(value)}`} />}
          <span className={variant === 'input' ? 'text-[var(--text-primary)] font-medium' : ''}>{currentOption?.label || value || 'None'}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
      </div>
      
      {isOpen && coords && createPortal(
        <div 
          className="fixed z-[9999] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md shadow-xl py-1 flex flex-col gap-1 max-h-60 overflow-auto"
          style={{ top: coords.top, left: coords.left, minWidth: coords.width }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={(e) => {
                 e.stopPropagation();
                 setIsOpen(false);
                 if (opt.value !== value) onChange(opt.value);
              }}
              className="px-2 py-1.5 hover:bg-[var(--bg-secondary)] cursor-pointer flex items-center gap-1.5 min-w-0"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusBadgeClass(opt.value)}`} />
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(opt.value)}`}>
                {opt.label}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
