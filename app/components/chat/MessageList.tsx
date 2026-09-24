import React, { useEffect, useRef } from 'react';
import { User, Bot } from 'lucide-react';
import { ChatMessage } from '../../../ai/provider';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent?: string;
  onSuggestionClick?: (prompt: string) => void;
}

export function MessageList({ messages, isLoading, streamingContent, onSuggestionClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingContent]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '32px',
        userSelect: 'none'
      }}>
        {/* Golden Compass & JoyBoy Title */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginBottom: '24px',
          background: 'rgba(18, 10, 6, 0.65)',
          padding: '10px 24px',
          borderRadius: '30px',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.7), 0 0 16px rgba(245, 158, 11, 0.25)',
          backdropFilter: 'blur(6px)'
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))' }}>
            <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 2" fill="rgba(43, 24, 16, 0.7)" />
            <circle cx="12" cy="12" r="7.5" stroke="#d97706" strokeWidth="1" />
            <polygon points="12,2 14,10 12,12 10,10" fill="#fbbf24" />
            <polygon points="12,22 14,14 12,12 10,14" fill="#92400e" />
            <polygon points="2,12 10,10 12,12 10,14" fill="#92400e" />
            <polygon points="22,12 14,10 12,12 14,14" fill="#fbbf24" />
            <circle cx="12" cy="12" r="2.5" fill="#fef3c7" stroke="#78350f" strokeWidth="1" />
          </svg>
          <span style={{ 
            fontSize: '24px', 
            fontWeight: 800, 
            color: '#fef3c7', 
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.9), 0 0 14px rgba(245, 158, 11, 0.6)',
            letterSpacing: '0.8px',
            fontFamily: 'serif, Georgia, sans-serif'
          }}>
            JoyBoy AI
          </span>
        </div>

        {/* 4 Wooden Plaque Suggestion Planks */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, minmax(240px, 310px))', 
          gap: '16px', 
          maxWidth: '650px', 
          width: '100%' 
        }}>
          {[
            'What is an operating system?',
            'Explain binary search algorithm',
            'How does CPU scheduling work',
            'Give me a C process example'
          ].map((prompt, idx) => (
            <button
              key={idx}
              className="wooden-plaque-btn"
              onClick={() => onSuggestionClick && onSuggestionClick(prompt)}
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const isLocalAI = msg.providerId === 'llamacpp' || msg.content.includes('*Local AI');
        const isMockAI = msg.role === 'assistant' && !isLocalAI;

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '14px',
              maxWidth: '85%',
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              flexDirection: isUser ? 'row-reverse' : 'row'
            }}
          >
            {/* Avatar */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: isUser ? '#2563eb' : '#1e293b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {isUser ? <User size={18} /> : <Bot size={18} color="#38bdf8" />}
            </div>

            {/* Bubble & Tag */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '100%' }}>
              {!isUser && (
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 600, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  marginLeft: '4px',
                  color: isLocalAI ? '#34d399' : '#fbbf24'
                }}>
                  <span style={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    backgroundColor: isLocalAI ? '#10b981' : '#f59e0b' 
                  }}></span>
                  <span>{isLocalAI ? 'Local AI · GGUF' : 'Mock AI · Offline Fallback'}</span>
                </div>
              )}

              <div style={{
                backgroundColor: isUser ? 'rgba(30, 58, 138, 0.88)' : 'rgba(18, 24, 38, 0.92)',
                border: isUser ? '1px solid #3b82f6' : '1px solid rgba(217, 119, 6, 0.35)',
                padding: '12px 16px',
                borderRadius: '12px',
                color: '#f8fafc',
                fontSize: '14px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)'
              }}>
                {isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.content}</div>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Streaming or Thinking State */}
      {isLoading && (
        <div style={{ display: 'flex', gap: '14px', alignSelf: 'flex-start', maxWidth: '85%' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Bot size={18} color="#38bdf8" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '4px',
              color: '#38bdf8'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#38bdf8'
              }}></span>
              <span>Generating response...</span>
            </div>

            <div style={{
              backgroundColor: 'rgba(18, 24, 38, 0.92)',
              border: '1px solid rgba(217, 119, 6, 0.35)',
              padding: '12px 16px',
              borderRadius: '12px',
              color: '#f8fafc',
              fontSize: '14px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)'
            }}>
              {streamingContent ? (
                <div>
                  <MarkdownRenderer content={streamingContent} />
                  <span style={{ 
                    display: 'inline-block', 
                    width: '7px', 
                    height: '14px', 
                    backgroundColor: '#d97706', 
                    marginLeft: '4px', 
                    verticalAlign: 'middle',
                    animation: 'pulse 1s infinite'
                  }}></span>
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                  Thinking & formulating study notes...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
