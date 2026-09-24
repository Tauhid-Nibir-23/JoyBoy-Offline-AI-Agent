import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface MessageComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ padding: '16px 24px 20px 24px', backgroundColor: '#090d16', borderTop: '1px solid #1e293b' }}>
      <form onSubmit={handleSubmit} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your study question or prompt... (Enter to send, Shift+Enter for new line)"
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            padding: '12px 48px 12px 14px',
            color: '#f8fafc',
            fontSize: '14px',
            outline: 'none',
            resize: 'none',
            maxHeight: '140px',
            lineHeight: 1.5
          }}
        />

        <button
          type="submit"
          disabled={!text.trim() || disabled}
          style={{
            position: 'absolute',
            right: '8px',
            bottom: '8px',
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            backgroundColor: text.trim() && !disabled ? '#2563eb' : '#1e293b',
            color: text.trim() && !disabled ? '#ffffff' : '#64748b',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: text.trim() && !disabled ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s'
          }}
        >
          <Send size={16} />
        </button>
      </form>

      <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
        Offline Study AI — Private & Local. Responses stored in SQLite on your PC.
      </div>
    </div>
  );
}
