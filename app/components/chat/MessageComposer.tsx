import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, 
  Square, 
  Paperclip, 
  GraduationCap, 
  FileText, 
  X, 
  Check, 
  AlertTriangle, 
  Loader2,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { DBDocument } from '../../../database/db';
import { StudyActionType } from '../../../study/types';

interface MessageComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled: boolean;
  useStudyMaterials?: boolean;
  onToggleStudyMaterials?: () => void;
  indexedDocCount?: number;
  attachedDocuments?: DBDocument[];
  onAttachFile?: (file: File) => Promise<void>;
  onDetachDocument?: (docId: string) => void;
  isUploading?: boolean;
  uploadStatusText?: string;
  onTriggerStudyAction?: (action: StudyActionType) => void;
}

export function MessageComposer({
  onSend,
  onStop,
  disabled,
  useStudyMaterials = true,
  onToggleStudyMaterials,
  indexedDocCount = 0,
  attachedDocuments = [],
  onAttachFile,
  onDetachDocument,
  isUploading = false,
  uploadStatusText,
  onTriggerStudyAction
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [showStudyMenu, setShowStudyMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  // Close study menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (studyMenuRef.current && !studyMenuRef.current.contains(e.target as Node)) {
        setShowStudyMenu(false);
      }
    };
    if (showStudyMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStudyMenu]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onAttachFile) {
      const file = files[0];
      await onAttachFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bottom-composer-wrapper">
      <form onSubmit={handleSubmit} className="bottom-composer-box">
        {/* Hidden File Input for PDF/Document Upload */}
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.txt,.md,.py,.js,.ts,.json"
          style={{ display: 'none' }}
        />

        {/* Attachment Chips Row */}
        {(attachedDocuments.length > 0 || isUploading) && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {attachedDocuments.map((doc) => {
              const isReady = doc.extraction_status === 'Ready';
              const hasOcrWarning = doc.error_message && doc.error_message.includes('Scanned');

              return (
                <div 
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#1f1f23',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    color: '#e4e4e7',
                    maxWidth: '280px'
                  }}
                  title={doc.filename}
                >
                  <FileText size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span style={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {doc.filename}
                  </span>
                  <span style={{ fontSize: '11px', color: '#71717a', flexShrink: 0 }}>
                    {formatFileSize(doc.file_size)}
                  </span>

                  {isReady ? (
                    hasOcrWarning ? (
                      <span style={{ color: '#f59e0b', fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '2px' }} title={doc.error_message || 'Scanned PDF'}>
                        <AlertTriangle size={11} />
                        <span>OCR</span>
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Check size={11} strokeWidth={2.5} />
                        <span>Ready</span>
                      </span>
                    )
                  ) : (
                    <span style={{ color: '#f59e0b', fontSize: '10.5px' }}>
                      {doc.extraction_status}
                    </span>
                  )}

                  {onDetachDocument && !disabled && (
                    <button
                      type="button"
                      onClick={() => onDetachDocument(doc.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#71717a',
                        cursor: 'pointer',
                        padding: '1px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px',
                        marginLeft: '2px'
                      }}
                      title="Remove attachment from this chat"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Uploading progress indicator */}
            {isUploading && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '12px',
                color: '#fbbf24'
              }}>
                <Loader2 size={12} className="animate-spin" />
                <span>{uploadStatusText || 'Indexing document...'}</span>
              </div>
            )}
          </div>
        )}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled 
              ? "AI is generating response... Click Stop to halt." 
              : attachedDocuments.length > 0
              ? `Ask anything about ${attachedDocuments[0].filename}${attachedDocuments.length > 1 ? ` and ${attachedDocuments.length - 1} more` : ''}...`
              : "Ask anything about your study materials..."
          }
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

        {/* Action Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }} ref={studyMenuRef}>
            {/* Attach Document Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#27272a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e4e4e7',
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'background 0.15s ease'
              }}
              title="Attach PDF, DOCX, or study document to this chat"
            >
              <Paperclip size={13} style={{ color: '#f59e0b' }} />
              <span>Attach</span>
            </button>

            {/* Study Dropdown Trigger Button */}
            {onTriggerStudyAction && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowStudyMenu(prev => !prev)}
                  disabled={disabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: showStudyMenu ? 'rgba(245, 158, 11, 0.15)' : '#27272a',
                    border: showStudyMenu ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: showStudyMenu ? '#fbbf24' : '#e4e4e7',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: disabled ? 'not-allowed' : 'pointer'
                  }}
                  title="Generate Study materials (Quiz, Summary, Notes, Flashcards) for this chat"
                >
                  <GraduationCap size={14} style={{ color: '#f59e0b' }} />
                  <span>Study</span>
                  <ChevronUp size={12} style={{ transform: showStudyMenu ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.15s' }} />
                </button>

                {/* Popover Menu for Study Actions */}
                {showStudyMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '36px',
                    left: 0,
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    padding: '6px',
                    width: '180px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>
                      Study Actions
                    </div>

                    {[
                      { action: 'explain' as StudyActionType, label: 'Explain Topic', icon: '💡' },
                      { action: 'summarize' as StudyActionType, label: 'Summarize', icon: '📝' },
                      { action: 'notes' as StudyActionType, label: 'Make Notes', icon: '📋' },
                      { action: 'quiz' as StudyActionType, label: 'Quiz Me', icon: '❓' },
                      { action: 'flashcards' as StudyActionType, label: 'Flashcards', icon: '🗂️' },
                      { action: 'plan' as StudyActionType, label: 'Study Plan', icon: '📅' }
                    ].map((item) => (
                      <button
                        key={item.action}
                        type="button"
                        onClick={() => {
                          setShowStudyMenu(false);
                          onTriggerStudyAction(item.action);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '7px 8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#f4f4f5',
                          fontSize: '12.5px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Document Scoped Badge (Phase 9 Part 18) */}
            {attachedDocuments.length > 0 && (
              <span 
                style={{
                  fontSize: '11.5px',
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500
                }}
                title={`This conversation is grounded on ${attachedDocuments.length} document${attachedDocuments.length > 1 ? 's' : ''}`}
              >
                <Check size={11} strokeWidth={2.5} />
                <span>Using {attachedDocuments.length} document{attachedDocuments.length > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>

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
