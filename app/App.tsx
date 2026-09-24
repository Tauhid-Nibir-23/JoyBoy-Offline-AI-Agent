import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  GraduationCap, 
  Database, 
  FileText, 
  RefreshCw, 
  Settings as SettingsIcon, 
  Wifi, 
  WifiOff, 
  Cpu, 
  HardDrive 
} from 'lucide-react';
import { initDatabase, getDatabaseStatus } from '../database/db';
import { detectEnvironment, SystemStatus } from '../core/environment';
import { ChatView } from './components/chat/ChatView';
import { ModelManagerView } from './components/settings/ModelManagerView';
import { chatService } from '../ai/chatService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'study' | 'knowledge' | 'documents' | 'sync' | 'settings'>('chat');
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
  const [aiProviderName, setAiProviderName] = useState<string>('Mock Assistant');

  useEffect(() => {
    let mounted = true;
    async function setupApp() {
      try {
        const ok = await initDatabase();
        if (!mounted) return;

        if (ok) {
          const status = getDatabaseStatus();
          setDbState({
            status: 'ready',
            error: null,
            tables: status.tables
          });
          const pName = await chatService.getProviderName();
          if (mounted) setAiProviderName(pName);
        } else {
          const status = getDatabaseStatus();
          setDbState({
            status: 'error',
            error: status.error || 'Failed to initialize SQLite database',
            tables: []
          });
        }
      } catch (err: any) {
        if (!mounted) return;
        setDbState({
          status: 'error',
          error: err?.message || 'Database error occurred',
          tables: []
        });
      }
    }

    setupApp();

    const handleOnline = () => setSysStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSysStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img 
            src="/assets/joyboy_logo.png" 
            alt="JoyBoy" 
            className="logo-badge-img" 
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#ffedd5', letterSpacing: '0.3px' }}>JoyBoy</div>
            <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 500 }}>v0.1.0 · Offline AI</div>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} />
            <span>Chat</span>
            {activeTab === 'chat' && <span className="ship-badge">⛵</span>}
          </button>

          <button 
            className={`nav-item ${activeTab === 'study' ? 'active' : ''}`}
            onClick={() => setActiveTab('study')}
          >
            <GraduationCap size={18} />
            <span>Study Mode</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'knowledge' ? 'active' : ''}`}
            onClick={() => setActiveTab('knowledge')}
          >
            <Database size={18} />
            <span>Knowledge Base</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={18} />
            <span>Documents</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            <RefreshCw size={18} />
            <span>Sync Center</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={18} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>OS:</span>
            <span style={{ color: '#cbd5e1' }}>{sysStatus.os}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Node:</span>
            <span style={{ color: '#cbd5e1' }}>{sysStatus.nodeVersion}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Status Header */}
        <header className="top-bar">
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')} View
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* AI Status Badge */}
            <div className="status-badge badge-neutral">
              <Cpu size={14} />
              <span className="status-dot dot-amber"></span>
              <span>AI: {aiProviderName}</span>
            </div>

            {/* Internet Status Badge */}
            <div className={`status-badge ${sysStatus.isOnline ? 'badge-online' : 'badge-offline'}`}>
              {sysStatus.isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className={`status-dot ${sysStatus.isOnline ? 'dot-green' : 'dot-red'}`}></span>
              <span>Internet: {sysStatus.isOnline ? 'Online Sync Available' : 'Offline Mode'}</span>
            </div>

            {/* DB Status Badge */}
            <div className={`status-badge ${dbState.status === 'ready' ? 'badge-online' : 'badge-offline'}`}>
              <HardDrive size={14} />
              <span className={`status-dot ${dbState.status === 'ready' ? 'dot-green' : (dbState.status === 'initializing' ? 'dot-amber' : 'dot-red')}`}></span>
              <span>DB: {dbState.status === 'ready' ? 'Ready' : (dbState.status === 'initializing' ? 'Connecting' : 'Error')}</span>
            </div>
          </div>
        </header>

        {/* Dynamic View Sections */}
        <section className="view-container" style={{ padding: activeTab === 'chat' && dbState.status === 'ready' ? 0 : '24px' }}>
          {activeTab === 'chat' && (
            dbState.status === 'ready' ? (
              <ChatView />
            ) : dbState.status === 'initializing' ? (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '350px' }}>
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <HardDrive size={36} style={{ margin: '0 auto 12px auto', color: '#f59e0b' }} />
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#ffedd5' }}>Initializing Offline SQLite Database...</p>
                  <p style={{ fontSize: '12px', marginTop: '6px', color: '#94a3b8' }}>Verifying local schema tables and offline storage.</p>
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '350px' }}>
                <div style={{ textAlign: 'center', color: '#f87171', maxWidth: '440px' }}>
                  <HardDrive size={36} style={{ margin: '0 auto 12px auto', color: '#ef4444' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fca5a5' }}>Database Initialization Failed</h3>
                  <p style={{ fontSize: '13px', marginTop: '8px', color: '#cbd5e1' }}>
                    {dbState.error || 'Failed to initialize local SQLite storage.'}
                  </p>
                  <button 
                    onClick={() => window.location.reload()} 
                    style={{
                      marginTop: '16px',
                      padding: '8px 16px',
                      backgroundColor: '#334155',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )
          )}

          {activeTab === 'study' && (
            <div className="card">
              <h3>Study Mode (Placeholder)</h3>
              <p style={{ color: '#94a3b8', marginTop: '8px' }}>
                Study modes (Explain, MCQ, CQ, Summarize, Viva Flashcards) will activate after Phase 2 & 6.
              </p>
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div className="card">
              <h3>Knowledge Base & Local RAG (Placeholder)</h3>
              <p style={{ color: '#94a3b8', marginTop: '8px' }}>
                Local indexed chunks and citations will be stored here in SQLite FTS5 index.
              </p>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="card">
              <h3>Document System (Placeholder)</h3>
              <p style={{ color: '#94a3b8', marginTop: '8px' }}>
                Supported formats: PDF, TXT, MD, DOCX, Code files. Drop files to ingest locally.
              </p>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="card">
              <h3>Sync Center (Placeholder)</h3>
              <p style={{ color: '#94a3b8', marginTop: '8px' }}>
                User-controlled allowlist sync dashboard. Network-aware and storage-aware sync engine.
              </p>
            </div>
          )}

          {activeTab === 'settings' && <ModelManagerView />}
        </section>
      </main>
    </div>
  );
}
