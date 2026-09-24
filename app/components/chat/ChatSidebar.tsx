import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Search } from 'lucide-react';
import { DBConversation } from '../../../database/db';

interface ChatSidebarProps {
  conversations: DBConversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
}

export function ChatSidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (c: DBConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const confirmRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <div style={{ 
      width: '260px', 
      backgroundColor: '#0c1322', 
      borderRight: '1px solid #1e293b', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* New Chat Action Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid #1e293b' }}>
        <button 
          onClick={onNewChat}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          <Plus size={18} />
          <span>New Chat</span>
        </button>

        {/* Search Bar */}
        <div style={{ 
          marginTop: '10px', 
          display: 'flex', 
          alignItems: 'center', 
          backgroundColor: '#1e293b', 
          borderRadius: '6px', 
          padding: '6px 10px',
          gap: '6px'
        }}>
          <Search size={14} color="#64748b" />
          <input 
            type="text" 
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#f8fafc',
              fontSize: '12px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Conversation List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', marginTop: '30px', padding: '0 10px' }}>
            {searchQuery ? 'No matching chats found' : 'No conversation history yet. Click "New Chat" to begin!'}
          </div>
        ) : (
          filtered.map((c) => {
            const isActive = c.id === activeId;
            const isEditing = c.id === editingId;

            return (
              <div
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <MessageSquare size={16} color={isActive ? '#38bdf8' : '#64748b'} style={{ flexShrink: 0 }} />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename(c.id, e as any);
                        if (e.key === 'Escape') cancelRename(e as any);
                      }}
                      autoFocus
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        border: '1px solid #3b82f6',
                        color: '#ffffff',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <span style={{ 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      fontWeight: isActive ? 600 : 400 
                    }}>
                      {c.title}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isEditing ? (
                    <>
                      <button 
                        onClick={(e) => confirmRename(c.id, e)} 
                        title="Confirm Title"
                        style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={cancelRename} 
                        title="Cancel"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={(e) => startRename(c, e)} 
                        title="Rename Chat"
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }} 
                        title="Delete Chat"
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
