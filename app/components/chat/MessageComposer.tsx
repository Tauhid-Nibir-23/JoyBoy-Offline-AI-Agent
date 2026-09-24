import React, { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';

interface MessageComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled: boolean;
}

export function MessageComposer({ onSend, onStop, disabled }: MessageComposerProps) {
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
    if (disabled && onStop) {
      onStop();
      return;
    }
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
    <div style={{ 
      padding: '12px 32px 16px 32px', 
      background: 'linear-gradient(180deg, transparent 0%, rgba(7, 11, 20, 0.8) 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%'
    }}>
      <form 
        onSubmit={handleSubmit} 
        className="wooden-composer-frame"
        style={{ 
          position: 'relative', 
          display: 'flex', 
          alignItems: 'center', 
          width: '100%',
          maxWidth: '850px',
          padding: '4px 6px'
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "AI is generating response... Click Stop to halt." : "What is an operating system? (Type your study prompt...)"}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            padding: '10px 48px 10px 16px',
            color: '#fffbeb',
            fontSize: '14px',
            outline: 'none',
            resize: 'none',
            maxHeight: '120px',
            lineHeight: 1.5,
            fontFamily: 'inherit'
          }}
        />

        {disabled && onStop ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generation"
            style={{
              position: 'absolute',
              right: '8px',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: '1px solid #f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)'
            }}
          >
            <Square size={13} fill="#ffffff" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!text.trim() || disabled}
            title="Send prompt"
            style={{
              position: 'absolute',
              right: '8px',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: text.trim() && !disabled ? '#d97706' : 'rgba(43, 24, 16, 0.6)',
              color: text.trim() && !disabled ? '#ffffff' : '#78350f',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: text.trim() && !disabled ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              boxShadow: text.trim() && !disabled ? '0 0 10px rgba(245, 158, 11, 0.6)' : 'none'
            }}
          >
            <Send size={15} />
          </button>
        )}
      </form>

      <div style={{ 
        textAlign: 'center', 
        fontSize: '11px', 
        color: '#d1b49d', 
        marginTop: '8px',
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)'
      }}>
        JoyBoy — Private & Local · Responses stored in SQLite on your PC
      </div>
    </div>
  );
}
