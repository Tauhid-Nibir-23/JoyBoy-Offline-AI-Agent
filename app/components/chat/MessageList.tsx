import React, { useEffect, useRef } from 'react';
import { Bot, User, Sparkles } from 'lucide-react';
import { ChatMessage } from '../../../ai/provider';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSuggestionClick?: (prompt: string) => void;
}

export function MessageList({ messages, isLoading, onSuggestionClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '32px',
        color: '#94a3b8'
      }}>
        <div style={{ 
          width: '56px', 
          height: '56px', 
          borderRadius: '16px', 
          backgroundColor: '#1e293b', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '16px',
          color: '#38bdf8'
        }}>
          <Sparkles size={28} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
          Offline Study Assistant
        </h2>
        <p style={{ fontSize: '14px', maxWidth: '460px', textAlign: 'center', lineHeight: 1.5, color: '#64748b' }}>
          Ask questions about your subjects, request code explanations, or practice active recall. All chat history and responses stay 100% local.
        </p>

        <div style={{ 
          marginTop: '24px', 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px', 
          maxWidth: '560px', 
          width: '100%' 
        }}>
          {[
            'What is an operating system?',
            'Explain binary search algorithm',
            'How does CPU scheduling work?',
            'Give me a C process example'
          ].map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => onSuggestionClick && onSuggestionClick(prompt)}
              style={{
                padding: '12px 14px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#cbd5e1',
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'border-color 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e293b')}
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {messages.map((msg) => {
        const isUser = msg.role === 'user';

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '14px',
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: isUser ? '80%' : '88%',
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

            {/* Bubble */}
            <div style={{
              backgroundColor: isUser ? '#1e3a8a' : '#0f172a',
              border: isUser ? '1px solid #2563eb' : '1px solid #1e293b',
              padding: '12px 16px',
              borderRadius: '12px',
              color: '#f8fafc',
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {isUser ? (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.content}</div>
              ) : (
                <MarkdownRenderer content={msg.content} />
              )}
            </div>
          </div>
        );
      })}

      {/* Typing/Loading State */}
      {isLoading && (
        <div style={{ display: 'flex', gap: '14px', alignSelf: 'flex-start' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={18} color="#38bdf8" />
          </div>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            padding: '12px 16px',
            borderRadius: '12px',
            color: '#94a3b8',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontStyle: 'italic' }}>Thinking & formulating study notes...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
