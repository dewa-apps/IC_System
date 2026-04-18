import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface MentionListProps {
  items: any[];
  command: (item: any) => void;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.name, label: item.name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden py-1 w-48 text-sm z-50">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={index}
            className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-secondary)] transition-colors ${
              index === selectedIndex ? 'bg-[var(--bg-secondary)]' : 'bg-transparent'
            }`}
            onClick={() => selectItem(index)}
          >
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold shrink-0">
              {item.name.substring(0, 2).toUpperCase()}
            </div>
            <span className="truncate text-[var(--text-primary)]">{item.name}</span>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-[var(--text-muted)] italic">No results</div>
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';
