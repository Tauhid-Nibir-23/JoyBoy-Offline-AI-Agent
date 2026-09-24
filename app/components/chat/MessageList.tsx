import React, { useEffect, useRef } from 'react';
import { User, Bot, BookOpen, FileText } from 'lucide-react';
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
        {/* JoyBoy Crest & Title Hero */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          gap: '14px', 
          marginBottom: '26px'
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Ambient golden aura behind the crest */}
            <div style={{
              position: 'absolute',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, rgba(180, 83, 9, 0.15) 50%, transparent 75%)',
              filter: 'blur(12px)',
              pointerEvents: 'none'
            }} />
            <img 
              src="/assets/joyboy_logo.png" 
              alt="JoyBoy Offline AI Agent" 
              style={{
                width: '130px',
                height: '130px',
                objectFit: 'contain',
                position: 'relative',
                filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 16px rgba(245, 158, 11, 0.4))',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06) rotate(1deg)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1) rotate(0deg)')}
            />
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            background: 'rgba(18, 10, 6, 0.75)',
            padding: '8px 22px',
            borderRadius: '24px',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.7), 0 0 12px rgba(245, 158, 11, 0.2)',
            backdropFilter: 'blur(8px)'
          }}>
            <span style={{ 
              fontSize: '20px', 
              fontWeight: 800, 
              color: '#fef3c7', 
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.9), 0 0 14px rgba(245, 158, 11, 0.6)',
              letterSpacing: '0.8px',
              fontFamily: 'serif, Georgia, sans-serif'
            }}>
              JoyBoy AI
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#fbbf24',
              letterSpacing: '0.6px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: 'rgba(217, 119, 6, 0.25)',
              border: '1px solid rgba(245, 158, 11, 0.4)'
            }}>
              OFFLINE AGENT
            </span>
          </div>
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
              backgroundColor: isUser ? '#2563eb' : 'rgba(28, 16, 10, 0.85)',
              border: isUser ? 'none' : '1px solid rgba(245, 158, 11, 0.4)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden'
            }}>
              {isUser ? (
                <User size={18} />
              ) : (
                <img 
                  src="/assets/joyboy_logo.png" 
                  alt="JoyBoy" 
                  style={{ width: '26px', height: '26px', objectFit: 'contain' }} 
                />
              )}
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
                backgroundColor: isUser ? 'rgba(30, 64, 150, 0.94)' : 'rgba(16, 22, 35, 0.96)',
                border: isUser ? '1px solid rgba(96, 165, 250, 0.5)' : '1px solid rgba(217, 119, 6, 0.35)',
                padding: '13px 18px',
                borderRadius: '12px',
                color: '#f8fafc',
                fontSize: '14.5px',
                lineHeight: 1.6,
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.55)'
              }}>
                {isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.content}</div>
                ) : (
                  <div>
                    <MarkdownRenderer content={msg.content} />
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(217, 119, 6, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          <BookOpen size={13} />
                          <span>Sources ({msg.sources.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {msg.sources.map((s, sIdx) => (
                            <div
                              key={sIdx}
                              title={s.snippet ? `Excerpt: ${s.snippet}` : undefined}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                                border: '1px solid rgba(217, 119, 6, 0.35)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '12px',
                                color: '#fed7aa',
                                cursor: 'default',
                                userSelect: 'none'
                              }}
                            >
                              <FileText size={12} style={{ color: '#f59e0b' }} />
                              <span style={{ fontWeight: 600 }}>{s.filename}</span>
                              {s.heading && (
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>· {s.heading}</span>
                              )}
                              <span style={{
                                fontSize: '10px',
                                color: '#10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                padding: '1px 4px',
                                borderRadius: '4px',
                                marginLeft: '2px'
                              }}>
                                {Math.round(s.similarity * 100)}% match
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
            backgroundColor: 'rgba(28, 16, 10, 0.85)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden'
          }}>
            <img 
              src="/assets/joyboy_logo.png" 
              alt="JoyBoy" 
              style={{ width: '26px', height: '26px', objectFit: 'contain' }} 
            />
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
              backgroundColor: 'rgba(16, 22, 35, 0.96)',
              border: '1px solid rgba(217, 119, 6, 0.35)',
              padding: '13px 18px',
              borderRadius: '12px',
              color: '#f8fafc',
              fontSize: '14.5px',
              lineHeight: 1.6,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.55)'
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
