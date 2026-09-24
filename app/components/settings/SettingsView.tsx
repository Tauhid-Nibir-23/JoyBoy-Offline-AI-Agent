import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Palette, 
  HardDrive, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  Cpu, 
  BookOpen, 
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  getSetting, 
  setSetting, 
  getDatabaseStats, 
  clearAllConversations, 
  clearAllDocuments, 
  clearEntireDatabase, 
  DatabaseStats, 
  isDatabaseReady 
} from '../../../database/db';
import { chatService } from '../../../ai/chatService';
import { modelManager } from '../../../models/manager';
import { ModelProfile } from '../../../models/types';
import { runDiagnostics, DiagnosticsReport } from '../../../core/diagnostics';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface SettingsViewProps {
  onNavigateToModels?: () => void;
}

export function SettingsView({ onNavigateToModels }: SettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'ai' | 'appearance' | 'storage' | 'diagnostics'>('ai');

  // AI Settings State
  const [provider, setProvider] = useState<'auto' | 'mock' | 'llamacpp'>('auto');
  const [activeModel, setActiveModel] = useState<ModelProfile | null>(null);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(512);
  const [contextLength, setContextLength] = useState<number>(4096);
  const [ragEnabled, setRagEnabled] = useState<boolean>(true);
  const [ragTopK, setRagTopK] = useState<number>(4);
  const [ragThreshold, setRagThreshold] = useState<number>(0.25);

  // Appearance State
  const [theme, setTheme] = useState<'default' | 'slate' | 'amber'>('default');
  const [chatDensity, setChatDensity] = useState<'comfortable' | 'compact'>('comfortable');

  // Storage Stats State
  const [dbStats, setDbStats] = useState<DatabaseStats>({
    conversationsCount: 0,
    messagesCount: 0,
    documentsCount: 0,
    chunksCount: 0,
    databaseSizeBytes: 0
  });

  // Diagnostics State
  const [diagnosticsReport, setDiagnosticsReport] = useState<DiagnosticsReport | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState<boolean>(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  // Confirm Modal / Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmDialog?.isOpen) {
        setConfirmDialog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog]);

  const loadAllSettings = () => {
    try {
      // AI
      setProvider(chatService.getProviderType());
      setActiveModel(modelManager.getActiveModel());
      
      const savedTemp = getSetting('temperature');
      if (savedTemp) setTemperature(parseFloat(savedTemp) || 0.7);

      const savedMaxTokens = getSetting('max_tokens');
      if (savedMaxTokens) setMaxTokens(parseInt(savedMaxTokens, 10) || 512);

      const savedCtx = getSetting('context_length');
      if (savedCtx) setContextLength(parseInt(savedCtx, 10) || 4096);

      setRagEnabled(chatService.isStudyMaterialsEnabled());

      const savedTopK = getSetting('rag_top_k');
      if (savedTopK) setRagTopK(parseInt(savedTopK, 10) || 4);

      const savedThreshold = getSetting('rag_similarity_threshold');
      if (savedThreshold) setRagThreshold(parseFloat(savedThreshold) || 0.25);

      // Appearance
      const savedTheme = getSetting('app_theme') as any;
      if (savedTheme) setTheme(savedTheme);

      const savedDensity = getSetting('chat_density') as any;
      if (savedDensity) setChatDensity(savedDensity);

      // Storage
      setDbStats(getDatabaseStats());
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  };

  const handleSaveAISetting = (key: string, value: string) => {
    setSetting(key, value);
    showToast('success', 'Setting saved.');
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const report = await runDiagnostics();
      setDiagnosticsReport(report);
    } catch (err: any) {
      showToast('error', 'Diagnostics failed: ' + err.message);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto', paddingBottom: '30px' }}>
      
      {/* Settings Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fef3c7', margin: 0 }}>
            Application Settings
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Configure offline AI inference, study retrieval, UI density, and local storage.
          </p>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          backgroundColor: toastMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : toastMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${toastMessage.type === 'success' ? '#10b981' : toastMessage.type === 'error' ? '#ef4444' : '#3b82f6'}`,
          color: toastMessage.type === 'success' ? '#6ee7b7' : toastMessage.type === 'error' ? '#fca5a5' : '#93c5fd'
        }}>
          {toastMessage.text}
        </div>
      )}

      {/* Settings Tab Selector */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveSubTab('ai')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: activeSubTab === 'ai' ? '1px solid #d97706' : '1px solid transparent',
            backgroundColor: activeSubTab === 'ai' ? 'rgba(180, 83, 9, 0.3)' : 'transparent',
            color: activeSubTab === 'ai' ? '#fef3c7' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Sliders size={16} />
          <span>AI & Study Settings</span>
        </button>

        <button
          onClick={() => setActiveSubTab('appearance')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: activeSubTab === 'appearance' ? '1px solid #d97706' : '1px solid transparent',
            backgroundColor: activeSubTab === 'appearance' ? 'rgba(180, 83, 9, 0.3)' : 'transparent',
            color: activeSubTab === 'appearance' ? '#fef3c7' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Palette size={16} />
          <span>Appearance</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('storage'); setDbStats(getDatabaseStats()); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: activeSubTab === 'storage' ? '1px solid #d97706' : '1px solid transparent',
            backgroundColor: activeSubTab === 'storage' ? 'rgba(180, 83, 9, 0.3)' : 'transparent',
            color: activeSubTab === 'storage' ? '#fef3c7' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <HardDrive size={16} />
          <span>Storage & Database</span>
        </button>

        <button
          onClick={() => setActiveSubTab('diagnostics')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: activeSubTab === 'diagnostics' ? '1px solid #d97706' : '1px solid transparent',
            backgroundColor: activeSubTab === 'diagnostics' ? 'rgba(180, 83, 9, 0.3)' : 'transparent',
            color: activeSubTab === 'diagnostics' ? '#fef3c7' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Activity size={16} />
          <span>Diagnostics & Health</span>
        </button>
      </div>

      {/* 1. AI Settings Section */}
      {activeSubTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffedd5', margin: '0 0 16px 0' }}>
              Inference & Model Configuration
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Active Provider */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Active AI Provider</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Select local llama.cpp or mock offline assistant</div>
                </div>
                <select
                  value={provider}
                  onChange={(e) => {
                    const next = e.target.value as any;
                    setProvider(next);
                    chatService.setProviderType(next);
                    showToast('success', `Provider updated to ${next.toUpperCase()}`);
                  }}
                  style={{
                    backgroundColor: '#090d16',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px'
                  }}
                >
                  <option value="auto">Auto Detect (Recommended)</option>
                  <option value="llamacpp">Local llama.cpp (Private GGUF)</option>
                  <option value="mock">Mock Study Assistant (Deterministic)</option>
                </select>
              </div>

              {/* Active Model Indicator & Manager Link */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Active Model</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {activeModel ? `${activeModel.name} (${activeModel.quantization})` : 'No active model configured'}
                  </div>
                </div>
                {onNavigateToModels && (
                  <button
                    onClick={onNavigateToModels}
                    style={{
                      padding: '6px 14px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Open Model Manager →
                  </button>
                )}
              </div>

              {/* Temperature Slider */}
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Temperature: {temperature}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Lower = more focused, Higher = creative</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTemperature(val);
                    handleSaveAISetting('temperature', String(val));
                  }}
                  style={{ width: '100%', accentColor: '#d97706' }}
                />
              </div>

              {/* Maximum Output Tokens */}
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Maximum Output Tokens: {maxTokens}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Max response length generated per request</span>
                </div>
                <input
                  type="range"
                  min="64"
                  max="2048"
                  step="64"
                  value={maxTokens}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setMaxTokens(val);
                    handleSaveAISetting('max_tokens', String(val));
                  }}
                  style={{ width: '100%', accentColor: '#d97706' }}
                />
              </div>

              {/* Context Size */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Context Window Size</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total token history bounded context</div>
                </div>
                <select
                  value={contextLength}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setContextLength(val);
                    handleSaveAISetting('context_length', String(val));
                  }}
                  style={{
                    backgroundColor: '#090d16',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px'
                  }}
                >
                  <option value={1024}>1024 tokens</option>
                  <option value={2048}>2048 tokens</option>
                  <option value={4096}>4096 tokens (Default)</option>
                  <option value={8192}>8192 tokens</option>
                </select>
              </div>
            </div>
          </div>

          {/* RAG Settings Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffedd5', margin: '0 0 16px 0' }}>
              Study Materials (RAG) Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* RAG Default ON/OFF */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>RAG Enabled by Default</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Automatically use indexed documents for answers</div>
                </div>
                <button
                  onClick={() => {
                    const next = !ragEnabled;
                    setRagEnabled(next);
                    chatService.setStudyMaterialsEnabled(next);
                    showToast('success', `Study Materials ${next ? 'enabled' : 'disabled'}`);
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: ragEnabled ? '#d97706' : '#334155',
                    color: ragEnabled ? '#fff' : '#94a3b8',
                    border: 'none'
                  }}
                >
                  {ragEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Retrieval Top-K */}
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Retrieval Top-K: {ragTopK} chunks</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Number of highest matching excerpts injected into chat</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={ragTopK}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setRagTopK(val);
                    handleSaveAISetting('rag_top_k', String(val));
                  }}
                  style={{ width: '100%', accentColor: '#d97706' }}
                />
              </div>

              {/* Similarity Threshold */}
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Similarity Threshold: {Math.round(ragThreshold * 100)}%</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Minimum vector similarity score required for injection</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.8"
                  step="0.05"
                  value={ragThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setRagThreshold(val);
                    handleSaveAISetting('rag_similarity_threshold', String(val));
                  }}
                  style={{ width: '100%', accentColor: '#d97706' }}
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 2. Appearance Section */}
      {activeSubTab === 'appearance' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffedd5', margin: '0 0 16px 0' }}>
            Display & Appearance
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Theme Preference */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Theme Mode</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Select app color theme palette</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['default', 'slate', 'amber'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t);
                      setSetting('app_theme', t);
                      showToast('success', `Theme set to ${t}`);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: theme === t ? '1px solid #d97706' : '1px solid #334155',
                      backgroundColor: theme === t ? 'rgba(180, 83, 9, 0.4)' : '#090d16',
                      color: theme === t ? '#fef3c7' : '#94a3b8',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {t === 'default' ? 'JoyBoy Dark' : t === 'slate' ? 'Cool Slate' : 'Warm Amber'}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Density */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>Chat Message Density</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Adjust padding and spacing of message bubbles</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['comfortable', 'compact'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setChatDensity(d);
                      setSetting('chat_density', d);
                      showToast('success', `Density set to ${d}`);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: chatDensity === d ? '1px solid #d97706' : '1px solid #334155',
                      backgroundColor: chatDensity === d ? 'rgba(180, 83, 9, 0.4)' : '#090d16',
                      color: chatDensity === d ? '#fef3c7' : '#94a3b8',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Storage Section */}
      {activeSubTab === 'storage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffedd5', margin: '0 0 16px 0' }}>
              SQLite Local Database Status
            </h3>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
              gap: '14px' 
            }}>
              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Database Engine</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                  {isDatabaseReady() ? 'SQLite 3 (Ready)' : 'Disconnected'}
                </div>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Conversations</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {dbStats.conversationsCount} <span style={{ fontSize: '12px', color: '#94a3b8' }}>({dbStats.messagesCount} msgs)</span>
                </div>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Documents</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {dbStats.documentsCount}
                </div>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Indexed Chunks</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
                  {dbStats.chunksCount}
                </div>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Estimated DB Size</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                  {formatBytes(dbStats.databaseSizeBytes)}
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card" style={{ padding: '20px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldAlert size={18} style={{ color: '#ef4444' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fca5a5', margin: 0 }}>
                Storage Management & Data Safety
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '0 0 16px 0' }}>
              Destructive operations require explicit confirmation. All changes apply locally.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#090d16', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>Clear All Conversations</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Delete all chat sessions and messages ({dbStats.conversationsCount} chats)</div>
                </div>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Clear All Conversations?',
                      message: `This will permanently delete all ${dbStats.conversationsCount} conversation(s) and their message history. This cannot be undone.`,
                      onConfirm: () => {
                        clearAllConversations();
                        setDbStats(getDatabaseStats());
                        showToast('info', 'All conversations have been cleared.');
                      }
                    });
                  }}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear Conversations
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#090d16', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>Clear Indexed Documents</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Delete all documents and vector chunks ({dbStats.documentsCount} documents)</div>
                </div>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Clear Indexed Documents?',
                      message: `This will remove all ${dbStats.documentsCount} document records and ${dbStats.chunksCount} knowledge chunks from the local database.`,
                      onConfirm: () => {
                        clearAllDocuments();
                        setDbStats(getDatabaseStats());
                        showToast('info', 'All document records have been cleared.');
                      }
                    });
                  }}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear Documents
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#090d16', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>Reset Entire Database</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Wipe all conversations, documents, and settings to clean factory state</div>
                </div>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Reset Entire Local Database?',
                      message: 'WARNING: This will wipe all conversations, documents, chunks, and custom settings. The application will be reset to factory defaults.',
                      onConfirm: () => {
                        clearEntireDatabase();
                        setDbStats(getDatabaseStats());
                        showToast('info', 'Database reset to clean factory state.');
                      }
                    });
                  }}
                  style={{
                    backgroundColor: '#ef4444',
                    border: '1px solid #b91c1c',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Reset Database
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 4. Diagnostics & Health Check Section */}
      {activeSubTab === 'diagnostics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
                  System Health & Offline Verification
                </h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Verify that SQLite, schema, active model, llama-server, and RAG vector store are functioning properly.
                </p>
              </div>

              <button
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#d97706',
                  color: '#fff',
                  cursor: isRunningDiagnostics ? 'not-allowed' : 'pointer',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600
                }}
              >
                <RefreshCw size={14} className={isRunningDiagnostics ? 'animate-spin' : ''} />
                <span>{isRunningDiagnostics ? 'Testing...' : 'Run Diagnostics'}</span>
              </button>
            </div>

            {diagnosticsReport ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: diagnosticsReport.allPassed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  border: `1px solid ${diagnosticsReport.allPassed ? '#10b981' : '#f59e0b'}`,
                  color: diagnosticsReport.allPassed ? '#6ee7b7' : '#fde68a',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {diagnosticsReport.allPassed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <strong>{diagnosticsReport.allPassed ? 'All System Checks Passed (PASS)' : 'Some Diagnostic Checks Reported Issues'}</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {new Date(diagnosticsReport.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {diagnosticsReport.results.map((check) => {
                    const isPass = check.status === 'PASS';
                    const isExpanded = !!expandedDetails[check.id];

                    return (
                      <div
                        key={check.id}
                        style={{
                          backgroundColor: '#090d16',
                          border: `1px solid ${isPass ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.4)'}`,
                          borderRadius: '8px',
                          padding: '12px 16px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isPass ? (
                              <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                            ) : (
                              <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                            )}
                            <div>
                              <strong style={{ fontSize: '13px', color: '#f8fafc' }}>{check.name}</strong>
                              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '2px 0 0 0' }}>{check.summary}</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: isPass ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: isPass ? '#6ee7b7' : '#fca5a5'
                            }}>
                              {check.status}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{check.durationMs}ms</span>
                            {check.details && (
                              <button
                                onClick={() => toggleDetails(check.id)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            )}
                          </div>
                        </div>

                        {check.details && isExpanded && (
                          <pre style={{
                            marginTop: '10px',
                            padding: '10px',
                            borderRadius: '6px',
                            backgroundColor: '#05070e',
                            border: '1px solid #1e293b',
                            fontSize: '11.5px',
                            color: isPass ? '#94a3b8' : '#fca5a5',
                            whiteSpace: 'pre-wrap',
                            overflowX: 'auto',
                            fontFamily: 'monospace'
                          }}>
                            {check.details}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: '#94a3b8' }}>
                <Activity size={32} style={{ margin: '0 auto 10px auto', color: '#64748b' }} />
                <p style={{ fontSize: '13px' }}>Click "Run Diagnostics" to verify all internal offline components.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '460px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '12px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#fca5a5' }}>
                {confirmDialog.title}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #475569',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
