import React, { useState, useEffect } from 'react';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversationsList();
  }, []);

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
    setActiveId(id);
    loadConversationMessages(id);
  };

  const handleNewChat = () => {
    try {
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

  const handleSendMessage = async (text: string) => {
    let targetConvId = activeId;

    try {
      if (!targetConvId) {
        const newConv = chatService.createConversation('New Chat');
        targetConvId = newConv.id;
        setActiveId(targetConvId);
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
      setErrorMsg(null);

      // Call service to process & generate response
      await chatService.sendMessage(targetConvId, text);

      // Refresh state from database
      setConversations(chatService.getConversations());
      setMessages(chatService.getMessages(targetConvId));
    } catch (err: any) {
      setErrorMsg('Failed to send message: ' + err.message);
    } finally {
      setIsLoading(false);
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
      />

      {/* Main Chat Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#090d16' }}>
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
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              {activeConv ? activeConv.title : 'New Chat'}
            </h2>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Active AI Provider: {chatService.getProviderName()}
            </span>
          </div>
        </div>

        {/* Message Thread */}
        <MessageList 
          messages={messages} 
          isLoading={isLoading} 
          onSuggestionClick={(prompt) => handleSendMessage(prompt)} 
        />

        {/* Bottom Composer */}
        <MessageComposer onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
