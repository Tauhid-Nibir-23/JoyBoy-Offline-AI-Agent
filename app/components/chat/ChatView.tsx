import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { ChatSidebar } from './ChatSidebar';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { chatService } from '../../../ai/chatService';
import { ChatMessage } from '../../../ai/provider';
import { DBConversation } from '../../../database/db';

export function ChatView() {
  const [conversations, setConversations] = useState<DBConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [providerInfo, setProviderInfo] = useState<{ id: string; name: string; isLocalAI: boolean }>(
    chatService.getActiveProviderSync()
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversations on mount & refresh provider info
  useEffect(() => {
    loadConversationsList();
    updateProviderInfo();
  }, []);

  const updateProviderInfo = async () => {
    await chatService.resolveProvider();
    setProviderInfo(chatService.getActiveProviderSync());
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
    // If generating on previous conversation, cancel it
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

      // Create new abort controller for this generation
      abortControllerRef.current = new AbortController();

      // Refresh provider info
      await updateProviderInfo();

      // Call service to process & generate response with token streaming
      await chatService.sendMessage(targetConvId, text, {
        signal: abortControllerRef.current.signal,
        onToken: (_token, accumulated) => {
          setStreamingContent(accumulated);
        }
      });

      // Refresh state from database
      setConversations(chatService.getConversations());
      setMessages(chatService.getMessages(targetConvId));
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        setErrorMsg('Inference Notice: ' + err.message);
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
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
        backgroundImage: "linear-gradient(rgba(7, 11, 20, 0.25), rgba(7, 11, 20, 0.45)), url('/assets/chat_bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#090d16',
        minWidth: 0 
      }}>
        {/* Error Notification Banner */}
        {errorMsg && (
          <div style={{
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
            <button 
              onClick={() => setErrorMsg(null)}
              style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 600 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Conversation Header */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid rgba(217, 119, 6, 0.2)',
          backgroundColor: 'rgba(10, 15, 29, 0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
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
        </div>

        {/* Message Thread */}
        <MessageList 
          messages={messages} 
          isLoading={isLoading} 
          streamingContent={streamingContent}
          onSuggestionClick={(prompt) => handleSendMessage(prompt)} 
        />

        {/* Bottom Composer */}
        <MessageComposer 
          onSend={handleSendMessage} 
          onStop={handleStopGeneration}
          disabled={isLoading} 
        />
      </div>
    </div>
  );
}
