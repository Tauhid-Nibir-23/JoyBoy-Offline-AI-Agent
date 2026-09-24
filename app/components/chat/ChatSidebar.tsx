import React, { useState, useRef, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Search, RefreshCw } from 'lucide-react';
import { DBConversation } from '../../../database/db';

interface ChatSidebarProps {
  conversations: DBConversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onRefresh?: () => void;
  width?: number;
  onWidthChange?: (newWidth: number) => void;
}

export function ChatSidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onRefresh,
  width = 260,
  onWidthChange
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const isResizing = useRef(false);

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

  // Sidebar drag resizer handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current || !onWidthChange) return;
    const newWidth = Math.min(Math.max(e.clientX, 200), 450);
    onWidthChange(newWidth);
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div style={{ 
      width: `${width}px`, 
      minWidth: `${width}px`,
      backgroundColor: '#0c121e', 
      backgroundImage: `linear-gradient(180deg, rgba(12, 18, 30, 0.55) 0%, rgba(12, 18, 30, 0.65) 45%, rgba(7, 11, 20, 0.85) 100%), url('/assets/chat_sidebar_bg.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center top',
      backgroundRepeat: 'no-repeat',
      borderRight: '1px solid rgba(217, 119, 6, 0.25)', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      userSelect: 'none'
    }}>
      {/* New Chat Action Header */}
      <div style={{ 
        padding: '12px', 
        borderBottom: '1px solid rgba(217, 119, 6, 0.25)',
        backgroundColor: 'rgba(10, 15, 29, 0.5)',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={onNewChat}
            title="Create New Chat (Ctrl+N)"
            className="wooden-action-btn"
            style={{ flex: 1 }}
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh conversation list"
              style={{
                background: 'rgba(217, 119, 6, 0.15)',
                border: '1px solid rgba(217, 119, 6, 0.35)',
                borderRadius: '8px',
                color: '#fef3c7',
                padding: '9px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RefreshCw size={15} />
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div style={{ 
          marginTop: '10px', 
          display: 'flex', 
          alignItems: 'center', 
          backgroundColor: 'rgba(20, 28, 44, 0.75)', 
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(217, 119, 6, 0.3)',
          borderRadius: '6px', 
          padding: '6px 10px',
          gap: '6px'
        }}>
          <Search size={14} color="#d97706" />
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
          <div style={{ 
            textAlign: 'center', 
            color: '#cbd5e1', 
            fontSize: '12px', 
            marginTop: '30px', 
            padding: '14px 12px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            borderRadius: '8px',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            margin: '20px 8px'
          }}>
            {searchQuery ? 'No matching chats found' : 'No conversation history yet. Click "New Chat" to begin!'}
          </div>
        ) : (
          filtered.map((c) => {
            const isActive = c.id === activeId;
            const isEditing = c.id === editingId;
            const formattedTime = formatTimestamp(c.updated_at);

            return (
              <div
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 10px',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  backgroundColor: isActive ? 'rgba(180, 83, 9, 0.4)' : 'rgba(15, 23, 42, 0.55)',
                  backdropFilter: 'blur(6px)',
                  border: isActive ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: isActive ? '0 2px 8px rgba(217, 119, 6, 0.25)' : 'none',
                  color: isActive ? '#fef3c7' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <MessageSquare size={16} color={isActive ? '#f59e0b' : '#64748b'} style={{ flexShrink: 0 }} />
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
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        fontWeight: isActive ? 600 : 400 
                      }}>
                        {c.title}
                      </span>
                      {formattedTime && (
                        <span style={{ fontSize: '10px', color: isActive ? '#94a3b8' : '#475569', marginTop: '1px' }}>
                          {formattedTime}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
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

      {/* Resize Handle */}
      {onWidthChange && (
        <div
          onMouseDown={handleMouseDown}
          title="Drag to resize sidebar"
          style={{
            position: 'absolute',
            top: 0,
            right: -3,
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 10
          }}
        />
      )}
    </div>
  );
}

function formatTimestamp(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

