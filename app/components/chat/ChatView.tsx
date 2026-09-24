import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, BookOpen, Trash2, RotateCw } from 'lucide-react';
import { ChatSidebar } from './ChatSidebar';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { chatService } from '../../../ai/chatService';
import { ChatMessage } from '../../../ai/provider';
import { DBConversation } from '../../../database/db';
import { ragService } from '../../../rag';
import { globalStatus } from '../../../core/status';

export function ChatView() {
  const [conversations, setConversations] = useState<DBConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [useStudyMaterials, setUseStudyMaterials] = useState<boolean>(chatService.isStudyMaterialsEnabled());
  const [indexedDocCount, setIndexedDocCount] = useState<number>(0);
  const [providerInfo, setProviderInfo] = useState<{ id: string; name: string; isLocalAI: boolean }>(
    chatService.getActiveProviderSync()
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversations on mount & refresh provider info
  useEffect(() => {
    loadConversationsList();
    updateProviderInfo();
    updateRAGStats();
  }, []);

  const updateProviderInfo = async () => {
    await chatService.resolveProvider();
    setProviderInfo(chatService.getActiveProviderSync());
  };

  const updateRAGStats = () => {
    try {
      const stats = ragService.getIndexingStats();
      setIndexedDocCount(stats.indexedDocuments);
    } catch {
      // fallback
    }
  };

  // Keyboard shortcut Ctrl+N for new chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversations, activeId]);

  const loadConversationsList = () => {
    try {
      const convs = chatService.getConversations();
      setConversations(convs);
      if (convs.length > 0 && !activeId) {
        setActiveId(convs[0].id);
        loadConversationMessages(convs[0].id);
      }
    } catch (err: any) {
      setErrorMsg('Failed to load conversations from SQLite: ' + err.message);
    }
  };

  const loadConversationMessages = (convId: string) => {
    try {
      const msgs = chatService.getMessages(convId);
      setMessages(msgs);
    } catch (err: any) {
      setErrorMsg('Failed to load messages: ' + err.message);
    }
  };

  const handleSelectConversation = (id: string) => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setStreamingContent('');
    }
    setActiveId(id);
    loadConversationMessages(id);
  };

  const handleNewChat = () => {
    try {
      if (isLoading && abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsLoading(false);
        setStreamingContent('');
      }
      const newConv = chatService.createConversation('New Chat');
      const updated = chatService.getConversations();
      setConversations(updated);
      setActiveId(newConv.id);
      setMessages([]);
    } catch (err: any) {
      setErrorMsg('Failed to create new conversation: ' + err.message);
    }
  };

  const handleDeleteConversation = (id: string) => {
    try {
      chatService.deleteConversation(id);
      const updated = chatService.getConversations();
      setConversations(updated);

      if (activeId === id) {
        if (updated.length > 0) {
          setActiveId(updated[0].id);
          loadConversationMessages(updated[0].id);
        } else {
          setActiveId(null);
          setMessages([]);
        }
      }
    } catch (err: any) {
      setErrorMsg('Failed to delete conversation: ' + err.message);
    }
  };

  const handleClearCurrentConversation = () => {
    if (!activeId) return;
    if (window.confirm('Are you sure you want to clear all messages in this conversation? The conversation topic will remain.')) {
      chatService.clearConversation(activeId);
      setMessages([]);
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    try {
      chatService.renameConversation(id, newTitle);
      setConversations(chatService.getConversations());
    } catch (err: any) {
      setErrorMsg('Failed to rename conversation: ' + err.message);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = async () => {
    if (!activeId || isLoading) return;
    setIsLoading(true);
    setStreamingContent('');
    setErrorMsg(null);
    abortControllerRef.current = new AbortController();
    globalStatus.setAIStatus('Generating');

    try {
      await updateProviderInfo();
      await chatService.regenerateLastAnswer(activeId, {
        signal: abortControllerRef.current.signal,
        useStudyMaterials,
        onToken: (_token, accumulated) => {
          setStreamingContent(accumulated);
        }
      });
      setConversations(chatService.getConversations());
      setMessages(chatService.getMessages(activeId));
      globalStatus.setAIStatus('Ready');
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        setErrorMsg('Regeneration Notice: ' + err.message);
        globalStatus.setAIStatus('Error');
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (text: string) => {
    let targetConvId = activeId;

    try {
      if (!targetConvId) {
        const newConv = chatService.createConversation('New Chat');
        targetConvId = newConv.id;
        setActiveId(targetConvId);
        setConversations(chatService.getConversations());
      }

      // Optimistically show user message
      const tempUserMsg: ChatMessage = {
        id: 'temp_u_' + Date.now(),
        conversationId: targetConvId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setIsLoading(true);
      setStreamingContent('');
      setErrorMsg(null);
      globalStatus.setAIStatus('Generating');

      // Create new abort controller for this generation
      abortControllerRef.current = new AbortController();

      // Refresh provider info
      await updateProviderInfo();

      // Call service to process & generate response with token streaming
      await chatService.sendMessage(targetConvId, text, {
        signal: abortControllerRef.current.signal,
        useStudyMaterials,
        onToken: (_token, accumulated) => {
          setStreamingContent(accumulated);
        }
      });

      // Refresh state from database
      setConversations(chatService.getConversations());
      setMessages(chatService.getMessages(targetConvId));
      globalStatus.setAIStatus('Ready');
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        setErrorMsg('Inference Notice: ' + err.message);
        globalStatus.setAIStatus('Error');
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  const toggleStudyMaterials = () => {
    const next = !useStudyMaterials;
    setUseStudyMaterials(next);
    chatService.setStudyMaterialsEnabled(next);
    updateRAGStats();
  };

  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onRefresh={loadConversationsList}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      {/* Main Chat Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        position: 'relative',
        minWidth: 0,
        backgroundColor: '#070a12',
        overflow: 'hidden'
      }}>
        {/* Background Art Layer */}
        <div 
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: "url('/assets/chat_bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: messages.length > 0 ? 0.60 : 0.85,
            transition: 'opacity 0.4s ease',
            pointerEvents: 'none',
            zIndex: 0
          }} 
        />

        {/* Ambient Tint Overlay */}
        <div 
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: messages.length > 0
              ? 'linear-gradient(180deg, rgba(7, 11, 20, 0.30) 0%, rgba(7, 11, 20, 0.45) 100%)'
              : 'linear-gradient(180deg, rgba(7, 11, 20, 0.15) 0%, rgba(7, 11, 20, 0.30) 100%)',
            transition: 'background 0.4s ease',
            pointerEvents: 'none',
            zIndex: 0
          }} 
        />

        {/* Error Notification Banner */}
        {errorMsg && (
          <div style={{
            position: 'relative',
            zIndex: 1,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '8px 16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handleRegenerate}
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid #ef4444',
                  color: '#fef3c7',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RotateCw size={11} />
                <span>Retry</span>
              </button>
              <button 
                onClick={() => setErrorMsg(null)}
                style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Conversation Header */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '12px 24px',
          borderBottom: '1px solid rgba(217, 119, 6, 0.2)',
          backgroundColor: messages.length > 0 ? 'rgba(8, 12, 22, 0.88)' : 'rgba(10, 15, 29, 0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.4s ease'
        }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
              {activeConv ? activeConv.title : 'New Chat'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '11px' }}>
              <span style={{ color: '#94a3b8' }}>Provider:</span>
              <span style={{ 
                color: providerInfo.isLocalAI ? '#34d399' : '#f59e0b',
                fontWeight: 600 
              }}>
                {providerInfo.name}
              </span>
              <span style={{ color: '#64748b' }}>
                ({providerInfo.isLocalAI ? 'Private GGUF' : 'Offline Fallback'})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Clear Conversation Button */}
            {messages.length > 0 && (
              <button
                onClick={handleClearCurrentConversation}
                title="Clear all messages in this conversation"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  backgroundColor: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid #475569',
                  color: '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={13} style={{ color: '#f87171' }} />
                <span>Clear</span>
              </button>
            )}

            {/* Use Study Materials (RAG) Toggle */}
            <button
              onClick={toggleStudyMaterials}
              title={useStudyMaterials ? 'Local knowledge search is active. Click to switch to normal AI chat.' : 'Click to enable local study materials search.'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: useStudyMaterials ? 'rgba(217, 119, 6, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                border: useStudyMaterials ? '1px solid #f59e0b' : '1px solid #475569',
                color: useStudyMaterials ? '#ffedd5' : '#94a3b8'
              }}
            >
              <BookOpen size={14} style={{ color: useStudyMaterials ? '#f59e0b' : '#64748b' }} />
              <span>Use Study Materials</span>
              <span style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                backgroundColor: useStudyMaterials ? '#d97706' : '#334155',
                color: useStudyMaterials ? '#1c1917' : '#94a3b8'
              }}>
                {useStudyMaterials ? `ON (${indexedDocCount} indexed)` : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', zIndex: 1 }}>
          <MessageList 
            messages={messages} 
            isLoading={isLoading} 
            streamingContent={streamingContent}
            onSuggestionClick={(prompt) => handleSendMessage(prompt)}
            onRegenerate={handleRegenerate}
            onRetry={handleRegenerate}
          />
        </div>

        {/* Bottom Composer */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <MessageComposer 
            onSend={handleSendMessage} 
            onStop={handleStopGeneration}
            disabled={isLoading} 
          />
        </div>
      </div>
    </div>
  );
}
