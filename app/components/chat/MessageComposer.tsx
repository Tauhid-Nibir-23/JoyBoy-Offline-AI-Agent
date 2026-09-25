import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square, BookOpen } from 'lucide-react';

interface MessageComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled: boolean;
  useStudyMaterials?: boolean;
  onToggleStudyMaterials?: () => void;
  indexedDocCount?: number;
}

export function MessageComposer({
  onSend,
  onStop,
  disabled,
  useStudyMaterials = true,
  onToggleStudyMaterials,
  indexedDocCount = 0
}: MessageComposerProps) {
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
    <div className="bottom-composer-wrapper">
      <form onSubmit={handleSubmit} className="bottom-composer-box">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "AI is generating response... Click Stop to halt." : "Ask anything about your study materials..."}
          disabled={disabled}
          rows={1}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#f4f4f5',
            fontSize: '14.5px',
            outline: 'none',
            resize: 'none',
            lineHeight: 1.5,
            fontFamily: 'inherit'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
          {/* Study Materials Toggle */}
          {onToggleStudyMaterials ? (
            <button
              type="button"
              onClick={onToggleStudyMaterials}
              className={`tool-toggle-btn ${useStudyMaterials ? 'active' : ''}`}
              title={useStudyMaterials ? 'Local document retrieval is ON' : 'Local document retrieval is OFF'}
            >
              <BookOpen size={13} style={{ color: useStudyMaterials ? '#f59e0b' : '#a1a1aa' }} />
              <span>Study Materials {useStudyMaterials ? 'ON' : 'OFF'}</span>
              {indexedDocCount > 0 && <span style={{ opacity: 0.65 }}>· {indexedDocCount} doc{indexedDocCount > 1 ? 's' : ''}</span>}
            </button>
          ) : <div />}

          {/* Action Button: Send or Stop */}
          {disabled && onStop ? (
            <button
              type="button"
              onClick={onStop}
              className="stop-circle-btn"
              title="Stop generation"
            >
              <Square size={13} fill="#ffffff" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim() || disabled}
              className="send-circle-btn"
              title="Send prompt"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </form>

      <div className="bottom-composer-footer">
        JoyBoy can make mistakes. Verify important study notes with your textbooks.
      </div>
    </div>
  );
}
