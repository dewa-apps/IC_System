import React, { useCallback, useState, useEffect } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import { MentionList } from './MentionList';
import { 
  Bold, Italic, Strikethrough, List, ListOrdered, Quote, Heading1, Heading2
} from 'lucide-react';
import { User } from '../types';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  users: User[];
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({ content, onChange, users, placeholder, minHeight = '50px' }: RichTextEditorProps) {
  // Use a ref to store initial content to avoid recreating Editor on every prop change
  const [isReady, setIsReady] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-1 py-0.5 rounded font-medium',
        },
        suggestion: {
          items: ({ query }) => {
            return users
              .filter(item => item.name.toLowerCase().startsWith(query.toLowerCase()))
              .slice(0, 5);
          },
          render: () => {
            let component: ReactRenderer;
            let popup: any;

            return {
              onStart: props => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as any,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate(props) {
                component.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect as any,
                });
              },

              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                return (component.ref as any)?.onKeyDown(props);
              },

              onExit() {
                if (popup && popup.length > 0) {
                  popup[0].destroy();
                }
                component.destroy();
              },
            };
          },
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 text-[var(--text-primary)]`,
        style: `min-height: ${minHeight};`,
      },
    },
  });

  // Watch for external content updates, e.g. when editing a different task.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleStrike = () => editor.chain().focus().toggleStrike().run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleBlockquote = () => editor.chain().focus().toggleBlockquote().run();
  const toggleHeading = (level: 1|2) => editor.chain().focus().toggleHeading({ level }).run();

  return (
    <div className="border border-[var(--border-color)] rounded-md overflow-hidden bg-[var(--bg-surface)] focus-within:ring-2 focus-within:ring-blue-500 transition-all flex flex-col relative w-full">
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-1 py-1 flex flex-wrap gap-0.5 items-center">
        <button onClick={toggleBold} className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-[var(--bg-surface)] text-blue-500 shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`} title="Bold" type="button"><Bold className="w-3.5 h-3.5" /></button>
        <button onClick={toggleItalic} className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-[var(--bg-surface)] text-blue-500 shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`} title="Italic" type="button"><Italic className="w-3.5 h-3.5" /></button>
        <button onClick={toggleStrike} className={`p-1.5 rounded transition-colors ${editor.isActive('strike') ? 'bg-[var(--bg-surface)] text-blue-500 shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`} title="Strikethrough" type="button"><Strikethrough className="w-3.5 h-3.5" /></button>
        
        <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
        
        <button onClick={() => toggleHeading(1)} className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-[var(--bg-surface)] text-blue-500 shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`} title="Heading 1" type="button"><Heading1 className="w-3.5 h-3.5" /></button>
        <button onClick={() => toggleHeading(2)} className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-[var(--bg-surface)] text-blue-500 shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`} title="Heading 2" type="button"><Heading2 className="w-3.5 h-3.5" /></button>
        
        <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
        
        <button onClick={toggleBulletList} className={`p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-[var(--bg-surface)] text-blue-500 shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`} title="Bullet List" type="button"><List className="w-3.5 h-3.5" /></button>
        <button onClick={toggleOrderedList} className={`p-1.5 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-[var(--bg-surface)] text-blue-500 shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`} title="Numbered List" type="button"><ListOrdered className="w-3.5 h-3.5" /></button>
        <button onClick={toggleBlockquote} className={`p-1.5 rounded transition-colors ${editor.isActive('blockquote') ? 'bg-[var(--bg-surface)] text-blue-500 shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`} title="Quote" type="button"><Quote className="w-3.5 h-3.5" /></button>
      </div>
      <div className="bg-[var(--bg-surface)] relative flex-1 cursor-text w-full" onClick={() => editor.chain().focus().run()}>
        {editor.isEmpty && placeholder && (
          <div className="absolute top-2 left-3 text-[var(--text-muted)] pointer-events-none text-sm italic">
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .ProseMirror { min-height: ${minHeight}; outline: none; }
        .ProseMirror p { margin-top: 0.2em; margin-bottom: 0.2em; line-height: 1.5; }
        .ProseMirror ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-top: 0.5em; margin-bottom: 0.5em; }
        .ProseMirror ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-top: 0.5em; margin-bottom: 0.5em; }
        .ProseMirror ul li, .ProseMirror ol li { display: list-item; }
        .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 1rem; margin-top: 0.5em; margin-bottom: 0.5em; color: var(--text-secondary); font-style: italic; }
        .dark .ProseMirror blockquote { border-left-color: #374151; }
        .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin-top: 0.8em; margin-bottom: 0.4em; }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin-top: 0.8em; margin-bottom: 0.4em; }
        .ProseMirror h3 { font-size: 1.125rem; font-weight: 600; margin-top: 0.8em; margin-bottom: 0.4em; }
      `}</style>
    </div>
  );
}
