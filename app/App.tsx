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
  const [dbInfo, setDbInfo] = useState<{ initialized: boolean; tables: string[] }>({ initialized: false, tables: [] });
  const [aiProviderName, setAiProviderName] = useState<string>('Mock Assistant');

  useEffect(() => {
    async function setupDb() {
      const ok = await initDatabase();
      if (ok) {
        setDbInfo(getDatabaseStatus());
        const pName = await chatService.getProviderName();
        setAiProviderName(pName);
      }
    }
    setupDb();

    const handleOnline = () => setSysStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSysStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-badge">JB</div>
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
            <div className={`status-badge ${dbInfo.initialized ? 'badge-online' : 'badge-offline'}`}>
              <HardDrive size={14} />
              <span className={`status-dot ${dbInfo.initialized ? 'dot-green' : 'dot-red'}`}></span>
              <span>DB: {dbInfo.initialized ? 'Initialized' : 'Error'}</span>
            </div>
          </div>
        </header>

        {/* Dynamic View Sections */}
        <section className="view-container" style={{ padding: activeTab === 'chat' ? 0 : '24px' }}>
          {activeTab === 'chat' && <ChatView />}

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
