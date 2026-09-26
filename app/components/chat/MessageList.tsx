import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  User, 
  BookOpen, 
  FileText, 
  Copy, 
  Check, 
  RotateCw, 
  AlertCircle, 
  X, 
  Trash2, 
  Cpu, 
  ArrowUpRight,
  ArrowDown
} from 'lucide-react';
import { ChatMessage, ChatMessageSource } from '../../../ai/provider';
import { chatService } from '../../../ai/chatService';
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

interface MessageItemProps {
  msg: ChatMessage;
  isLatestAssistant: boolean;
  isLoading: boolean;
  isCopied: boolean;
  onCopy: (msgId: string, content: string) => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onDeleteMessage?: (msgId: string) => void;
  onInspectSource: (source: ChatMessageSource) => void;
  isSourcesExpanded: boolean;
  onToggleSources: (msgId: string) => void;
}

const MessageItem = React.memo(function MessageItem({
  msg,
  isLatestAssistant,
  isLoading,
  isCopied,
  onCopy,
  onRegenerate,
  onRetry,
  onDeleteMessage,
  onInspectSource,
  isSourcesExpanded,
  onToggleSources
}: MessageItemProps) {
  const isUser = msg.role === 'user';
  const isError = !isUser && (msg.content.includes('⚠️ **Local AI Error:**') || msg.content.includes('⚠️'));
  const isMock = msg.providerId === 'mock' || chatService.getProviderType() === 'mock';
  const isLocalAI = !isUser && !isError && !isMock;

  if (isUser) {
    return (
      <div className="user-msg-container">
        <div className="user-msg-bubble" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
          <div style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{msg.content}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', opacity: 0.6, userSelect: 'none' }}>
            <button
              onClick={() => onCopy(msg.id, msg.content)}
              style={{ background: 'none', border: 'none', color: isCopied ? '#10b981' : '#a1a1aa', cursor: 'pointer', padding: '2px' }}
              title="Copy message"
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
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
    );
  }

  return (
    <div className="assistant-msg-container">
      <div className="assistant-avatar" style={{ userSelect: 'none' }}>
        <img 
          src="/assets/joyboy_logo.png" 
          alt="JoyBoy" 
          style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
        />
      </div>

      <div className="assistant-msg-body" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
        {/* Compact Status Tag (Truthful Local AI indicator) */}
        <div style={{ 
          fontSize: '11px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          color: isError ? '#f87171' : isLocalAI ? '#10b981' : '#f59e0b',
          userSelect: 'none'
        }}>
          <span style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            backgroundColor: isError ? '#ef4444' : isLocalAI ? '#10b981' : '#f59e0b',
            boxShadow: isLocalAI ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none'
          }}></span>
          <span>{isError ? 'Local AI Error' : isLocalAI ? 'Qwen 2.5 3B · Offline' : 'Demo / Mock Mode'}</span>
        </div>

        {/* Formatted Markdown Content */}
        <div style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
          <MarkdownRenderer content={msg.content} />
        </div>

        {/* Compact Sources Indicator */}
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ marginTop: '8px', userSelect: 'none' }}>
            <button
              onClick={() => onToggleSources(msg.id)}
              className="compact-source-badge"
              title="Click to view study sources"
            >
              <BookOpen size={13} />
              <span>Sources · {msg.sources.length}</span>
            </button>

            {/* Expanded sources view if toggled */}
            {isSourcesExpanded && (
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
                    onClick={() => onInspectSource(s)}
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
        <div className="msg-actions-row" style={{ userSelect: 'none' }}>
          <button
            onClick={() => onCopy(msg.id, msg.content)}
            className="msg-action-btn"
            title="Copy answer to clipboard"
          >
            {isCopied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span style={{ color: isCopied ? '#10b981' : undefined }}>{isCopied ? 'Copied ✓' : 'Copy'}</span>
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
  );
});

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
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inspectedSource, setInspectedSource] = useState<ChatMessageSource | null>(null);
  const [expandedSourcesMsgId, setExpandedSourcesMsgId] = useState<string | null>(null);

  const prevMessagesLenRef = useRef<number>(messages.length);
  const prevLoadingRef = useRef<boolean>(isLoading);

  // Monitor scroll position on container
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isUp = distanceFromBottom > 90;
    isUserScrolledUpRef.current = isUp;
    setShowScrollBottom(isUp);
  }, []);

  // When messages array changes: scroll to bottom if user is already near bottom or sent a message
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNewUserMsg = messages.length > prevMessagesLenRef.current && messages[messages.length - 1]?.role === 'user';
    prevMessagesLenRef.current = messages.length;

    if (isNewUserMsg) {
      isUserScrolledUpRef.current = false;
      setShowScrollBottom(false);
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else if (!isUserScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Smart Auto-Scroll during streaming: follow smoothly ONLY if user hasn't scrolled up
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isLoading) return;

    if (!isUserScrolledUpRef.current) {
      // Instantaneous non-blocking scroll update without queueing smooth animations
      el.scrollTop = el.scrollHeight;
    }
  }, [streamingContent, isLoading]);

  // When generation finishes: keep scroll stable, do NOT violently jump user
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;

    if (wasLoading && !isLoading) {
      const el = containerRef.current;
      if (el && !isUserScrolledUpRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [isLoading]);

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

  const handleCopyMessage = useCallback((msgId: string, content: string) => {
    try {
      const cleaned = content
        .replace(/\n\n\*\(?(Local AI|Mock Assistant|Demo \/ Mock Mode|Generation stopped by user)[\s\S]*?\*?$/, '')
        .trim();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cleaned);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = cleaned;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(msgId);
      setTimeout(() => {
        setCopiedId((curr) => (curr === msgId ? null : curr));
      }, 2000);
    } catch {
      // ignore
    }
  }, []);

  const handleScrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isUserScrolledUpRef.current = false;
    setShowScrollBottom(false);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleToggleSources = useCallback((msgId: string) => {
    setExpandedSourcesMsgId((curr) => (curr === msgId ? null : msgId));
  }, []);

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
                <strong>No local AI model loaded.</strong> {chatService.getProviderType() === 'mock' ? 'Running in Developer Mock Mode.' : 'Configure or scan GGUF models in Model Manager.'}
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
    <div 
      className="messages-scroll-area"
      ref={containerRef}
      onScroll={handleScroll}
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      <div className="messages-inner-wrap" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
        {messages.map((msg, index) => {
          const isLatestAssistant = index === lastAssistantIdx;

          return (
            <div key={msg.id} style={{ width: '100%', userSelect: 'text', WebkitUserSelect: 'text' }}>
              <MessageItem
                msg={msg}
                isLatestAssistant={isLatestAssistant}
                isLoading={isLoading}
                isCopied={copiedId === msg.id}
                onCopy={handleCopyMessage}
                onRegenerate={onRegenerate}
                onRetry={onRetry}
                onDeleteMessage={onDeleteMessage}
                onInspectSource={setInspectedSource}
                isSourcesExpanded={expandedSourcesMsgId === msg.id}
                onToggleSources={handleToggleSources}
              />
            </div>
          );
        })}

        {/* Streaming Active Indicator */}
        {isLoading && (
          <div className="assistant-msg-container" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
            <div className="assistant-avatar" style={{ userSelect: 'none' }}>
              <img 
                src="/assets/joyboy_logo.png" 
                alt="JoyBoy" 
                style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
              />
            </div>
            <div className="assistant-msg-body" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
              {streamingContent ? (
                <div style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                  <MarkdownRenderer content={streamingContent} />
                  <span style={{ 
                    display: 'inline-block', 
                    width: '6px', 
                    height: '14px', 
                    backgroundColor: '#f59e0b', 
                    marginLeft: '4px', 
                    verticalAlign: 'middle',
                    userSelect: 'none'
                  }}></span>
                </div>
              ) : (
                <div style={{ color: '#a1a1aa', fontSize: '13.5px', userSelect: 'none' }}>
                  Generating...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Smart Auto-Scroll Button */}
      {showScrollBottom && (
        <button
          onClick={handleScrollToBottom}
          className="scroll-bottom-pill"
          title="Scroll to latest response"
          type="button"
        >
          <ArrowDown size={13} strokeWidth={2.5} />
          <span>{isLoading ? 'New response' : 'Scroll to bottom'}</span>
        </button>
      )}

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
              fontFamily: 'monospace',
              userSelect: 'text',
              WebkitUserSelect: 'text'
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

      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}
