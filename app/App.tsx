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
  HardDrive,
  Layers,
  BookOpen
} from 'lucide-react';
import { initDatabase, getDatabaseStatus } from '../database/db';
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
  const [activeTab, setActiveTab] = useState<'chat' | 'study' | 'knowledge' | 'documents' | 'models' | 'sync' | 'settings'>('chat');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
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

          // Initialize model manager & sync engine status
          await modelManager.initialize();
          const active = modelManager.getActiveModel();
          const eng = localAIEngine.getStatus();
          globalStatus.setModelStatus(eng.isServerRunning ? 'Loaded' : 'Not Loaded', active?.name);
          globalStatus.setAIStatus('Ready');
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
        try {
          const newConv = chatService.createConversation('New Chat');
          setActiveConvId(newConv.id);
          setActiveTab('chat');
        } catch {
          setActiveTab('chat');
        }
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
            className={`nav-item ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            <Cpu size={18} />
            <span>Model Manager</span>
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
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
            {activeTab === 'models' ? 'Model Manager' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* AI Status Badge */}
            <div className="status-badge badge-neutral">
              <Cpu size={13} />
              <span className={`status-dot ${appStatus.ai === 'Ready' ? 'dot-green' : appStatus.ai === 'Generating' ? 'dot-amber' : appStatus.ai === 'Error' ? 'dot-red' : 'dot-amber'}`}></span>
              <span>AI: {appStatus.ai}</span>
            </div>

            {/* Model Status Badge */}
            <div className={`status-badge ${appStatus.model === 'Loaded' ? 'badge-online' : 'badge-neutral'}`}>
              <Layers size={13} />
              <span className={`status-dot ${appStatus.model === 'Loaded' ? 'dot-green' : 'dot-amber'}`}></span>
              <span>Model: {appStatus.model}</span>
            </div>

            {/* DB Status Badge */}
            <div className={`status-badge ${appStatus.db === 'Ready' ? 'badge-online' : 'badge-offline'}`}>
              <HardDrive size={13} />
              <span className={`status-dot ${appStatus.db === 'Ready' ? 'dot-green' : (appStatus.db === 'Connecting' ? 'dot-amber' : 'dot-red')}`}></span>
              <span>DB: {appStatus.db}</span>
            </div>

            {/* RAG Status Badge */}
            <div className={`status-badge ${appStatus.rag === 'Ready' ? 'badge-online' : 'badge-neutral'}`}>
              <BookOpen size={13} />
              <span className={`status-dot ${appStatus.rag === 'Ready' ? 'dot-green' : appStatus.rag === 'Indexing' ? 'dot-amber' : 'dot-red'}`}></span>
              <span>RAG: {appStatus.rag}</span>
            </div>

            {/* Internet Status Badge */}
            <div className={`status-badge ${sysStatus.isOnline ? 'badge-online' : 'badge-offline'}`}>
              {sysStatus.isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span className={`status-dot ${sysStatus.isOnline ? 'dot-green' : 'dot-red'}`}></span>
              <span>{sysStatus.isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </header>

        {/* Dynamic View Sections */}
        <section className="view-container" style={{ padding: activeTab === 'chat' && dbState.status === 'ready' ? 0 : '24px', overflowY: activeTab === 'chat' ? 'hidden' : 'auto', height: 'calc(100vh - 52px)' }}>
          {activeTab === 'chat' && (
            dbState.status === 'ready' ? (
              <ChatView initialConversationId={activeConvId} />
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
            <StudyModeView 
              initialAction={studyParams.action}
              initialDocumentId={studyParams.documentId}
              onNavigateToChat={(convId) => {
                setActiveConvId(convId);
                setActiveTab('chat');
              }}
            />
          )}

          {activeTab === 'knowledge' && <KnowledgeBaseView onStudyAction={handleStudyAction} />}

          {activeTab === 'documents' && <DocumentLibraryView onStudyAction={handleStudyAction} />}

          {activeTab === 'models' && <ModelManagerView />}

          {activeTab === 'sync' && (
            <div className="card">
              <h3>Sync Center (Placeholder)</h3>
              <p style={{ color: '#94a3b8', marginTop: '8px' }}>
                User-controlled allowlist sync dashboard. Network-aware and storage-aware sync engine.
              </p>
            </div>
          )}

          {activeTab === 'settings' && <SettingsView onNavigateToModels={() => setActiveTab('models')} />}
        </section>
      </main>
    </div>
  );
}
