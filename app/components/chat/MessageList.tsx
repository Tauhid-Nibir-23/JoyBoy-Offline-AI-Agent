import React, { useState, useEffect, useRef } from 'react';
import { User, BookOpen, FileText, Copy, Check, RotateCw, AlertCircle, X, Trash2, Cpu, ArrowUpRight } from 'lucide-react';
import { ChatMessage, ChatMessageSource } from '../../../ai/provider';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent?: string;
  onSuggestionClick?: (prompt: string) => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  isModelInstalled?: boolean;
  onOpenModelManager?: () => void;
}

export function MessageList({
  messages,
  isLoading,
  streamingContent,
  onSuggestionClick,
  onRegenerate,
  onRetry,
  onDeleteMessage,
  isModelInstalled = true,
  onOpenModelManager
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inspectedSource, setInspectedSource] = useState<ChatMessageSource | null>(null);
  const [expandedSourcesMsgId, setExpandedSourcesMsgId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingContent]);

  // Accessibility: close inspection modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectedSource) setInspectedSource(null);
        if (expandedSourcesMsgId) setExpandedSourcesMsgId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedSource, expandedSourcesMsgId]);

  const handleCopyMessage = (msgId: string, content: string) => {
    const cleaned = content.replace(/\n\n\*(Local AI|Mock Assistant|Demo \/ Mock Mode)[^*]+\*$/, '').trim();
    navigator.clipboard.writeText(cleaned);
    setCopiedId(msgId);
    setTimeout(() => {
      setCopiedId((curr) => (curr === msgId ? null : curr));
    }, 2000);
  };

  // Empty State: Modern ChatGPT Hero with Quick Prompts
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="chat-empty-hero">
        <h1 className="hero-title">How can I help you study?</h1>

        {/* Model Missing Alert Banner */}
        {!isModelInstalled && (
          <div style={{
            width: '100%',
            maxWidth: '680px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <div style={{ fontSize: '13px', color: '#e4e4e7', lineHeight: 1.4 }}>
                <strong>Local AI model is not installed.</strong> Running in Demo / Mock Mode.
              </div>
            </div>
            {onOpenModelManager && (
              <button
                onClick={onOpenModelManager}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#27272a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fef3c7',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>Open Model Manager</span>
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>
        )}

        {/* Suggestion Pills */}
        <div className="suggestion-pills-row">
          {[
            'Explain a topic',
            'Summarize a PDF',
            'Generate MCQs',
            'Make study notes',
            'What is deadlock?'
          ].map((prompt, idx) => (
            <button
              key={idx}
              className="suggestion-pill"
              onClick={() => onSuggestionClick && onSuggestionClick(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const lastAssistantIdx = messages.map(m => m.role).lastIndexOf('assistant');

  return (
    <div className="messages-scroll-area">
      <div className="messages-inner-wrap">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const isLocalAI = msg.providerId === 'llamacpp' || msg.content.includes('*Local AI');
          const isError = !isUser && msg.content.includes('⚠️ **Local AI Error:**');
          const isLatestAssistant = index === lastAssistantIdx;

          return (
            <div key={msg.id} style={{ width: '100%' }}>
              {isUser ? (
                /* User Message: Sleek right-aligned dark pill */
                <div className="user-msg-container">
                  <div className="user-msg-bubble">
                    <div>{msg.content}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', opacity: 0.6 }}>
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        style={{ background: 'none', border: 'none', color: copiedId === msg.id ? '#10b981' : '#a1a1aa', cursor: 'pointer', padding: '2px' }}
                        title="Copy message"
                      >
                        {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      {onDeleteMessage && (
                        <button
                          onClick={() => onDeleteMessage(msg.id)}
                          style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '2px' }}
                          title="Delete message"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Assistant Message: Clean left-aligned markdown */
                <div className="assistant-msg-container">
                  <div className="assistant-avatar">
                    <img 
                      src="/assets/joyboy_logo.png" 
                      alt="JoyBoy" 
                      style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
                    />
                  </div>

                  <div className="assistant-msg-body">
                    {/* Compact Status Tag */}
                    <div style={{ 
                      fontSize: '11px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      color: isError ? '#f87171' : isLocalAI ? '#10b981' : '#f59e0b'
                    }}>
                      <span style={{ 
                        width: '5px', 
                        height: '5px', 
                        borderRadius: '50%', 
                        backgroundColor: isError ? '#ef4444' : isLocalAI ? '#10b981' : '#f59e0b' 
                      }}></span>
                      <span>{isError ? 'Inference Notice' : isLocalAI ? 'JoyBoy AI (GGUF)' : 'Demo / Mock Mode'}</span>
                    </div>

                    <MarkdownRenderer content={msg.content} />

                    {/* Compact Sources Indicator */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          onClick={() => setExpandedSourcesMsgId(expandedSourcesMsgId === msg.id ? null : msg.id)}
                          className="compact-source-badge"
                          title="Click to view study sources"
                        >
                          <BookOpen size={13} />
                          <span>Sources · {msg.sources.length}</span>
                        </button>

                        {/* Expanded sources view if toggled */}
                        {expandedSourcesMsgId === msg.id && (
                          <div style={{
                            marginTop: '8px',
                            backgroundColor: '#18181b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}>
                            {msg.sources.map((s, sIdx) => (
                              <div
                                key={sIdx}
                                onClick={() => setInspectedSource(s)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  backgroundColor: '#27272a',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <FileText size={13} style={{ color: '#f59e0b' }} />
                                  <span style={{ color: '#f4f4f5' }}>{s.filename}</span>
                                  {s.pageNumber ? <span style={{ color: '#fbbf24', fontWeight: 500 }}>· Page {s.pageNumber}</span> : null}
                                  {s.heading && <span style={{ color: '#71717a' }}>· {s.heading}</span>}
                                </div>
                                <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 600 }}>
                                  {Math.round(s.similarity * 100)}% match
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="msg-actions-row">
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="msg-action-btn"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      {isLatestAssistant && onRegenerate && !isLoading && (
                        <button
                          onClick={onRegenerate}
                          className="msg-action-btn"
                          title="Regenerate answer"
                        >
                          <RotateCw size={12} />
                          <span>Regenerate</span>
                        </button>
                      )}

                      {isError && onRetry && !isLoading && (
                        <button
                          onClick={onRetry}
                          className="msg-action-btn"
                          style={{ color: '#f87171' }}
                          title="Retry failed message"
                        >
                          <RotateCw size={12} />
                          <span>Retry</span>
                        </button>
                      )}

                      {onDeleteMessage && (
                        <button
                          onClick={() => onDeleteMessage(msg.id)}
                          className="msg-action-btn"
                          title="Delete message"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming Active Indicator */}
        {isLoading && (
          <div className="assistant-msg-container">
            <div className="assistant-avatar">
              <img 
                src="/assets/joyboy_logo.png" 
                alt="JoyBoy" 
                style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
              />
            </div>
            <div className="assistant-msg-body">
              {streamingContent ? (
                <div>
                  <MarkdownRenderer content={streamingContent} />
                  <span style={{ 
                    display: 'inline-block', 
                    width: '6px', 
                    height: '14px', 
                    backgroundColor: '#f59e0b', 
                    marginLeft: '4px', 
                    verticalAlign: 'middle' 
                  }}></span>
                </div>
              ) : (
                <div style={{ color: '#a1a1aa', fontSize: '13.5px' }}>
                  Generating...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Source Citation Modal */}
      {inspectedSource && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#18181b',
            border: '1px solid var(--border-active)',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '560px',
            width: '90%',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: '#f59e0b' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', margin: 0 }}>
                  {inspectedSource.filename}
                </h3>
              </div>
              <button
                onClick={() => setInspectedSource(null)}
                style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '12px' }}>
              <span style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#6ee7b7',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600
              }}>
                Similarity: {Math.round(inspectedSource.similarity * 100)}%
              </span>
              {inspectedSource.heading && (
                <span style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {inspectedSource.heading}
                </span>
              )}
            </div>

            <div style={{
              backgroundColor: '#09090b',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '13px',
              color: '#d4d4d8',
              lineHeight: 1.6,
              maxHeight: '260px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace'
            }}>
              {inspectedSource.snippet || 'No excerpt available.'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setInspectedSource(null)}
                className="btn"
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
