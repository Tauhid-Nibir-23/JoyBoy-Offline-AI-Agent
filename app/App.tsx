import React, { useState, useEffect } from 'react';
import { 
  Plus,
  Search,
  MessageSquare, 
  GraduationCap, 
  Database, 
  FileText, 
  Settings as SettingsIcon, 
  Cpu, 
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown
} from 'lucide-react';
import { initDatabase, getDatabaseStatus, DBConversation } from '../database/db';
import { detectEnvironment, SystemStatus } from '../core/environment';
import { ChatView } from './components/chat/ChatView';
import { ModelManagerView } from './components/settings/ModelManagerView';
import { SettingsView } from './components/settings/SettingsView';
import { DocumentLibraryView } from './components/documents/DocumentLibraryView';
import { KnowledgeBaseView } from './components/knowledge/KnowledgeBaseView';
import { StudyModeView } from './components/study/StudyModeView';
import { StudyActionType } from '../study/types';
import { chatService } from '../ai/chatService';
import { modelManager } from '../models/manager';
import { localAIEngine } from '../ai/localEngine';
import { useGlobalStatus, globalStatus } from '../core/status';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'study' | 'knowledge' | 'documents' | 'models' | 'settings'>('chat');
  const [conversations, setConversations] = useState<DBConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editConvTitle, setEditConvTitle] = useState('');

  const [studyParams, setStudyParams] = useState<{
    action: StudyActionType;
    documentId?: string | null;
  }>({ action: 'explain', documentId: null });

  const [sysStatus, setSysStatus] = useState<SystemStatus>(detectEnvironment());
  const [dbState, setDbState] = useState<{
    status: 'initializing' | 'ready' | 'error';
    error: string | null;
    tables: string[];
  }>({
    status: 'initializing',
    error: null,
    tables: []
  });

  const appStatus = useGlobalStatus();

  const handleStudyAction = (docId: string, action: StudyActionType) => {
    setStudyParams({ action, documentId: docId });
    setActiveTab('study');
  };

  const loadConversations = () => {
    try {
      const list = chatService.getConversations();
      setConversations(list);
      if (list.length > 0 && !activeConvId) {
        setActiveConvId(list[0].id);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let mounted = true;
    async function setupApp() {
      try {
        globalStatus.setDBStatus('Connecting');
        const ok = await initDatabase();
        if (!mounted) return;

        if (ok) {
          const status = getDatabaseStatus();
          setDbState({
            status: 'ready',
            error: null,
            tables: status.tables
          });
          globalStatus.setDBStatus('Ready');

          // Initialize model manager
          await modelManager.initialize();
          let active = modelManager.getActiveModel();

          // Auto-select installed model if available and none selected
          if (!active || !active.path) {
            const registered = modelManager.getRegisteredModels();
            const installed = registered.find(m => (m.status === 'Ready' || m.status === 'Installed') && m.path);
            if (installed) {
              await modelManager.selectActiveModel(installed.id);
              active = modelManager.getActiveModel();
            }
          }

          // Preload model if available
          if (active && active.path) {
            globalStatus.setModelStatus('Not Loaded', active.name);
            const loaded = await localAIEngine.loadModel(active.path);
            const eng = localAIEngine.getStatus();
            globalStatus.setModelStatus(eng.isServerRunning || loaded ? 'Loaded' : 'Not Loaded', active.name);
          } else {
            globalStatus.setModelStatus('Not Loaded');
          }
          globalStatus.setAIStatus('Ready');

          loadConversations();
        } else {
          const status = getDatabaseStatus();
          setDbState({
            status: 'error',
            error: status.error || 'Failed to initialize SQLite database',
            tables: []
          });
          globalStatus.setDBStatus('Error', status.error || 'Failed');
          globalStatus.setAIStatus('Error');
        }
      } catch (err: any) {
        if (!mounted) return;
        setDbState({
          status: 'error',
          error: err?.message || 'Database error occurred',
          tables: []
        });
        globalStatus.setDBStatus('Error', err?.message);
        globalStatus.setAIStatus('Error');
      }
    }

    setupApp();

    const handleOnline = () => setSysStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSysStatus(prev => ({ ...prev, isOnline: false }));

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleNewChat = () => {
    try {
      const newConv = chatService.createConversation('New Chat');
      loadConversations();
      setActiveConvId(newConv.id);
      setActiveTab('chat');
    } catch {
      setActiveTab('chat');
    }
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      chatService.deleteConversation(id);
      const updated = chatService.getConversations();
      setConversations(updated);
      if (activeConvId === id) {
        if (updated.length > 0) {
          setActiveConvId(updated[0].id);
        } else {
          setActiveConvId(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const startRename = (c: DBConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(c.id);
    setEditConvTitle(c.title);
  };

  const confirmRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editConvTitle.trim()) {
      chatService.renameConversation(id, editConvTitle.trim());
      loadConversations();
    }
    setEditingConvId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(null);
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeModel = modelManager.getActiveModel();

  return (
    <div className="app-container">
      {/* Unified ChatGPT-Style Left Navigation Sidebar */}
      <aside className={`sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        {/* Header with Clickable Logo to Toggle */}
        <div className="sidebar-header">
          <button 
            className="sidebar-logo-group"
            onClick={() => setSidebarOpen(prev => !prev)}
            title="Click logo to toggle sidebar"
          >
            <img 
              src="/assets/joyboy_logo.png" 
              alt="JoyBoy" 
              className="logo-badge-img" 
            />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#f4f4f5', letterSpacing: '0.2px' }}>JoyBoy</div>
              <div style={{ fontSize: '10.5px', color: '#a1a1aa' }}>v0.1.0 · Offline AI</div>
            </div>
          </button>

          <button 
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Top Actions: New Chat & Search */}
        <div className="sidebar-top-actions">
          <button 
            className="new-chat-btn"
            onClick={handleNewChat}
            title="New Chat (Ctrl+N)"
          >
            <Plus size={16} />
            <span>New chat</span>
          </button>

          <div className="search-chat-container">
            <Search size={14} style={{ color: '#71717a' }} />
            <input 
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-chat-input"
            />
          </div>
        </div>

        {/* Nav Menu Items */}
        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={16} />
            <span>Chat</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'study' ? 'active' : ''}`}
            onClick={() => setActiveTab('study')}
          >
            <GraduationCap size={16} />
            <span>Study Mode</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'knowledge' ? 'active' : ''}`}
            onClick={() => setActiveTab('knowledge')}
          >
            <Database size={16} />
            <span>Knowledge Base</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={16} />
            <span>Documents</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            <Cpu size={16} />
            <span>Model Manager</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={16} />
            <span>Settings</span>
          </button>
        </nav>

        {/* Chats Section */}
        <div className="chats-section">
          <div className="chats-header">Chats</div>

          {filteredConversations.length === 0 ? (
            <div style={{ color: '#71717a', fontSize: '12px', padding: '10px 8px' }}>
              {searchQuery ? 'No chats match search' : 'No chats yet'}
            </div>
          ) : (
            filteredConversations.map(c => {
              const isSelected = activeTab === 'chat' && activeConvId === c.id;
              const isEditing = editingConvId === c.id;

              return (
                <div 
                  key={c.id}
                  className={`chat-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setActiveConvId(c.id);
                    setActiveTab('chat');
                  }}
                >
                  {isEditing ? (
                    <div 
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input 
                        type="text"
                        value={editConvTitle}
                        onChange={(e) => setEditConvTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename(c.id, e as any);
                          if (e.key === 'Escape') cancelRename(e as any);
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          backgroundColor: '#27272a',
                          border: '1px solid #3f3f46',
                          borderRadius: '4px',
                          color: '#f4f4f5',
                          fontSize: '12px',
                          padding: '2px 6px',
                          outline: 'none'
                        }}
                      />
                      <button 
                        onClick={(e) => confirmRename(c.id, e)}
                        className="chat-action-btn"
                        title="Confirm"
                      >
                        <Check size={12} color="#10b981" />
                      </button>
                      <button 
                        onClick={cancelRename}
                        className="chat-action-btn"
                        title="Cancel"
                      >
                        <X size={12} color="#ef4444" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        {c.title}
                      </span>

                      <div className="chat-item-actions">
                        <button 
                          onClick={(e) => startRename(c, e)}
                          className="chat-action-btn"
                          title="Rename"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteConversation(c.id, e)}
                          className="chat-action-btn delete"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Profile */}
        <div className="sidebar-footer">
          <div className="user-avatar">JB</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              JoyBoy AI
            </div>
            <div style={{ fontSize: '11px', color: '#71717a' }}>
              Offline Personal Assistant
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Minimal Top Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            {!sidebarOpen && (
              <button 
                className="sidebar-toggle-btn"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f4f4f5' }}
              >
                <img 
                  src="/assets/joyboy_logo.png" 
                  alt="JoyBoy" 
                  style={{ width: '22px', height: '22px', objectFit: 'contain' }} 
                />
                <PanelLeft size={18} />
              </button>
            )}

            <button 
              className="top-bar-model-badge"
              onClick={() => setActiveTab('models')}
              title="Click to view Model Manager"
            >
              <Cpu size={14} style={{ color: appStatus.model === 'Loaded' ? '#10b981' : '#f59e0b' }} />
              <span>{activeModel?.name ? activeModel.name : (appStatus.model === 'Loaded' ? 'Local GGUF' : 'Demo Mode')}</span>
              <ChevronDown size={13} style={{ opacity: 0.6 }} />
            </button>
          </div>

          <div className="top-bar-right">
            <div className="subtle-status-item">
              <span className={`status-dot ${appStatus.ai === 'Ready' ? 'dot-green' : appStatus.ai === 'Generating' ? 'dot-amber' : 'dot-red'}`} />
              <span>AI {appStatus.ai}</span>
            </div>

            <div className="subtle-status-item">
              <span className={`status-dot ${appStatus.model === 'Loaded' ? 'dot-green' : 'dot-amber'}`} />
              <span>Model {appStatus.model}</span>
            </div>

            <div className="subtle-status-item">
              <span className={`status-dot ${appStatus.rag === 'Ready' ? 'dot-green' : 'dot-amber'}`} />
              <span>RAG {appStatus.rag}</span>
            </div>

            <div className="subtle-status-item" style={{ opacity: 0.7 }}>
              <span className={`status-dot ${sysStatus.isOnline ? 'dot-green' : 'dot-red'}`} />
              <span>{sysStatus.isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Views Container */}
        <section className="view-container">
          {activeTab === 'chat' && (
            <ChatView 
              initialConversationId={activeConvId}
              onOpenModelManager={() => setActiveTab('models')}
              onConversationsChange={loadConversations}
            />
          )}

          {activeTab === 'study' && (
            <div style={{ padding: '24px' }}>
              <StudyModeView 
                initialAction={studyParams.action}
                initialDocumentId={studyParams.documentId}
                onNavigateToChat={(convId) => {
                  loadConversations();
                  setActiveConvId(convId);
                  setActiveTab('chat');
                }}
              />
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div style={{ padding: '24px' }}>
              <KnowledgeBaseView onStudyAction={handleStudyAction} />
            </div>
          )}

          {activeTab === 'documents' && (
            <div style={{ padding: '24px' }}>
              <DocumentLibraryView onStudyAction={handleStudyAction} />
            </div>
          )}

          {activeTab === 'models' && (
            <div style={{ padding: '24px' }}>
              <ModelManagerView />
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ padding: '24px' }}>
              <SettingsView onNavigateToModels={() => setActiveTab('models')} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
