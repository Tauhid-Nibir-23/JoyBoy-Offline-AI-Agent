import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Cpu, 
  FileText, 
  ShieldCheck, 
  Database, 
  Terminal, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Activity,
  Globe
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
  onNavigateToDocuments?: () => void;
  onNavigateToKnowledge?: () => void;
  onThemeChange?: (theme: 'default' | 'slate' | 'amber') => void;
}

export function SettingsView({ 
  onNavigateToModels, 
  onNavigateToDocuments,
  onNavigateToKnowledge,
  onThemeChange 
}: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<'general' | 'ai' | 'documents' | 'privacy' | 'data' | 'advanced'>('general');

  // General State
  const [theme, setTheme] = useState<'default' | 'slate' | 'amber'>('default');
  const [responseLanguage, setResponseLanguage] = useState<'auto' | 'bn' | 'en'>('auto');

  // AI Model State
  const [provider, setProvider] = useState<'auto' | 'mock' | 'llamacpp'>('auto');
  const [activeModel, setActiveModel] = useState<ModelProfile | null>(null);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [contextLength, setContextLength] = useState<number>(4096);
  const [maxTokens, setMaxTokens] = useState<number>(512);

  // Documents State
  const [dbStats, setDbStats] = useState<DatabaseStats>({
    conversationsCount: 0,
    messagesCount: 0,
    documentsCount: 0,
    chunksCount: 0,
    databaseSizeBytes: 0
  });

  // Advanced State (Collapsed by default)
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState<boolean>(false);
  const [diagnosticsReport, setDiagnosticsReport] = useState<DiagnosticsReport | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState<boolean>(false);

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

  const loadAllSettings = () => {
    try {
      // General
      const savedTheme = getSetting('app_theme') as any;
      if (savedTheme === 'default' || savedTheme === 'slate' || savedTheme === 'amber') {
        setTheme(savedTheme);
      }

      const savedLang = getSetting('response_language') as any;
      if (savedLang === 'bn' || savedLang === 'en' || savedLang === 'auto') {
        setResponseLanguage(savedLang);
      }

      // AI Model
      setProvider(chatService.getProviderType());
      setActiveModel(modelManager.getActiveModel());

      const savedTemp = getSetting('temperature');
      if (savedTemp) setTemperature(parseFloat(savedTemp) || 0.7);

      const savedMaxTokens = getSetting('max_tokens');
      if (savedMaxTokens) setMaxTokens(parseInt(savedMaxTokens, 10) || 512);

      const savedCtx = getSetting('context_length');
      if (savedCtx) setContextLength(parseInt(savedCtx, 10) || 4096);

      // Storage
      setDbStats(getDatabaseStats());
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const report = await runDiagnostics();
      setDiagnosticsReport(report);
      showToast('success', `Diagnostics completed: ${report.allPassed ? 'ALL PASSED' : 'ISSUES DETECTED'}`);
    } catch (err: any) {
      showToast('error', 'Diagnostics failed: ' + err.message);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  return (
    <div className="view-content-wrapper" style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toastMessage.type === 'success' ? '#065f46' : toastMessage.type === 'error' ? '#991b1b' : '#1e3a8a',
          color: '#ffffff',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#f4f4f5', margin: '0 0 6px 0' }}>
          Settings
        </h2>
        <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
          Manage your personal workspace, local AI model, document processing, and privacy options.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '12px',
        marginBottom: '20px',
        overflowX: 'auto'
      }}>
        {[
          { id: 'general' as const, label: 'General', icon: Palette },
          { id: 'ai' as const, label: 'AI Model', icon: Cpu },
          { id: 'documents' as const, label: 'Documents', icon: FileText },
          { id: 'privacy' as const, label: 'Privacy', icon: ShieldCheck },
          { id: 'data' as const, label: 'Data', icon: Database },
          { id: 'advanced' as const, label: 'Advanced', icon: Terminal }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: isActive ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.06)',
                backgroundColor: isActive ? 'rgba(245, 158, 11, 0.15)' : '#18181b',
                color: isActive ? '#fbbf24' : '#a1a1aa',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={14} style={{ color: isActive ? '#f59e0b' : '#71717a' }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. GENERAL SECTION */}
      {activeSection === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', margin: '0 0 16px 0' }}>
              Interface & Appearance
            </h3>

            {/* Theme Picker */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Theme Palette</div>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Select your preferred desktop look and feel</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['default', 'slate', 'amber'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t);
                      setSetting('app_theme', t);
                      window.dispatchEvent(new CustomEvent('app_theme_changed', { detail: t }));
                      onThemeChange?.(t);
                      showToast('success', `Theme updated`);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: theme === t ? '1px solid #f59e0b' : '1px solid #27272a',
                      backgroundColor: theme === t ? 'rgba(245, 158, 11, 0.2)' : '#09090b',
                      color: theme === t ? '#fbbf24' : '#a1a1aa',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {t === 'default' ? 'JoyBoy Dark' : t === 'slate' ? 'Cool Slate' : 'Warm Amber'}
                  </button>
                ))}
              </div>
            </div>

            {/* Response Language Selection */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={14} style={{ color: '#f59e0b' }} />
                  <span>Response Language</span>
                </div>
                <div style={{ fontSize: '12px', color: '#71717a' }}>
                  Automatic language matching for Bangla, Banglish, and English
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'auto' as const, label: 'Auto (Default)' },
                  { id: 'bn' as const, label: 'বাংলা' },
                  { id: 'en' as const, label: 'English' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setResponseLanguage(item.id);
                      setSetting('response_language', item.id);
                      showToast('success', `Language policy set to ${item.label}`);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: responseLanguage === item.id ? '1px solid #f59e0b' : '1px solid #27272a',
                      backgroundColor: responseLanguage === item.id ? 'rgba(245, 158, 11, 0.2)' : '#09090b',
                      color: responseLanguage === item.id ? '#fbbf24' : '#a1a1aa',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. AI MODEL SECTION */}
      {activeSection === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', margin: '0 0 16px 0' }}>
              Local Model Configuration
            </h3>

            {/* Installed Model Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Installed Model</div>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Recommended: Qwen2.5-3B-Instruct GGUF</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#e4e4e7', fontWeight: 500 }}>
                  {activeModel?.name || 'Qwen2.5-3B-Instruct (Default)'}
                </span>
                {onNavigateToModels && (
                  <button
                    onClick={onNavigateToModels}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#27272a',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f59e0b',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Manage
                  </button>
                )}
              </div>
            </div>

            {/* Model Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Model Runtime Status</div>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Local llama.cpp CPU inference</div>
              </div>
              <span style={{
                color: activeModel?.status === 'Ready' || activeModel?.status === 'Installed' ? '#10b981' : '#f59e0b',
                fontSize: '12.5px',
                fontWeight: 600,
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '4px 10px',
                borderRadius: '6px'
              }}>
                {activeModel?.status || 'Available'}
              </span>
            </div>

            {/* Temperature Slider */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Temperature ({temperature})</div>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Lower values produce more deterministic study answers</div>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTemperature(val);
                  setSetting('temperature', String(val));
                }}
                style={{ width: '140px', accentColor: '#f59e0b' }}
              />
            </div>

            {/* Context Length */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Context Length</div>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Optimized for 16 GB RAM (4096 tokens recommended)</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[2048, 4096, 8192].map(ctx => (
                  <button
                    key={ctx}
                    onClick={() => {
                      setContextLength(ctx);
                      setSetting('context_length', String(ctx));
                      showToast('success', `Context set to ${ctx}`);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: contextLength === ctx ? '1px solid #f59e0b' : '1px solid #27272a',
                      backgroundColor: contextLength === ctx ? 'rgba(245, 158, 11, 0.2)' : '#09090b',
                      color: contextLength === ctx ? '#fbbf24' : '#a1a1aa',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {ctx}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DOCUMENTS SECTION */}
      {activeSection === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', margin: '0 0 16px 0' }}>
              Document Intelligence & Storage
            </h3>

            {/* Storage Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#09090b', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ fontSize: '11.5px', color: '#71717a' }}>Documents Indexed</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f4f4f5', marginTop: '4px' }}>
                  {dbStats.documentsCount} documents
                </div>
              </div>

              <div style={{ backgroundColor: '#09090b', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ fontSize: '11.5px', color: '#71717a' }}>Chunks Generated</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f4f4f5', marginTop: '4px' }}>
                  {dbStats.chunksCount} chunks
                </div>
              </div>

              <div style={{ backgroundColor: '#09090b', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ fontSize: '11.5px', color: '#71717a' }}>Storage Used</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                  {formatBytes(dbStats.databaseSizeBytes)}
                </div>
              </div>
            </div>

            {/* OCR Pipeline Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid rgba(255, 255, 255, 0.06)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Local OCR Engine</div>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Scanned and image-based PDF text detection</div>
              </div>
              <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 500, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                ✓ Offline Fallback Active
              </span>
            </div>

            {/* Chunking Strategy */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderBottom: (onNavigateToDocuments || onNavigateToKnowledge) ? '1px solid rgba(255, 255, 255, 0.06)' : 'none', paddingBottom: (onNavigateToDocuments || onNavigateToKnowledge) ? '14px' : 0 }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Chunking Strategy</div>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Page-aware atomic paragraphs (~400 tokens / 80 token overlap)</div>
              </div>
              <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 500 }}>
                Page-Preserving
              </span>
            </div>

            {/* Secondary Views Access */}
            {(onNavigateToDocuments || onNavigateToKnowledge) && (
              <div style={{ display: 'flex', gap: '10px', paddingTop: '14px' }}>
                {onNavigateToDocuments && (
                  <button
                    onClick={onNavigateToDocuments}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#27272a',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f4f4f5',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Open Document Library
                  </button>
                )}
                {onNavigateToKnowledge && (
                  <button
                    onClick={onNavigateToKnowledge}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#27272a',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f4f4f5',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Open Knowledge Base
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. PRIVACY SECTION */}
      {activeSection === 'privacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', margin: '0 0 16px 0' }}>
              Local Privacy & Offline Guarantees
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Local-Only Operation</div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>All embeddings, inference, documents, and chat history stay on your device</div>
                </div>
                <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                  Active (Offline)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Telemetry & Tracking</div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>Zero telemetry, zero analytics, zero external network calls</div>
                </div>
                <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                  Disabled
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. DATA SECTION */}
      {activeSection === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ef4444', margin: '0 0 16px 0' }}>
              Data & Storage Actions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Clear All Conversations</div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>Delete all chat sessions and messages</div>
                </div>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Clear All Conversations?',
                      message: 'This will delete all conversations and messages from local storage. Your documents will remain safe.',
                      onConfirm: () => {
                        clearAllConversations();
                        setDbStats(getDatabaseStats());
                        showToast('success', 'Conversations cleared');
                      }
                    });
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Chats
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Clear All Documents</div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>Remove all imported documents, chunks, and embeddings</div>
                </div>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Clear All Documents?',
                      message: 'This will delete all imported study documents and vector chunks. Conversations will remain.',
                      onConfirm: () => {
                        clearAllDocuments();
                        setDbStats(getDatabaseStats());
                        showToast('success', 'Documents cleared');
                      }
                    });
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Documents
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f87171' }}>Reset Application</div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>Restore default schema, clearing all data</div>
                </div>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Reset Application?',
                      message: 'This will reset all conversations, documents, study plans, and preferences to defaults.',
                      onConfirm: () => {
                        clearEntireDatabase();
                        setDbStats(getDatabaseStats());
                        loadAllSettings();
                        showToast('success', 'Application reset to factory defaults');
                      }
                    });
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Reset All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADVANCED SECTION (Collapsed by default) */}
      {activeSection === 'advanced' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px' }}>
            <button
              onClick={() => setIsAdvancedExpanded(prev => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                color: '#f4f4f5',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', margin: 0 }}>
                  Technical Diagnostics & Advanced Engine Settings
                </h3>
                <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                  Diagnostics, inference provider overrides, and system health checks
                </div>
              </div>
              {isAdvancedExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {isAdvancedExpanded && (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Provider Override */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Inference Provider</div>
                    <div style={{ fontSize: '12px', color: '#71717a' }}>Select engine implementation</div>
                  </div>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const next = e.target.value as any;
                      setProvider(next);
                      chatService.setProviderType(next);
                      showToast('success', `Provider set to ${next}`);
                    }}
                    style={{
                      backgroundColor: '#09090b',
                      border: '1px solid #27272a',
                      color: '#f4f4f5',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12.5px'
                    }}
                  >
                    <option value="auto">Auto (llama.cpp with mock fallback)</option>
                    <option value="llamacpp">Local llama.cpp (GGUF)</option>
                    <option value="mock">Offline Mock Assistant</option>
                  </select>
                </div>

                {/* Diagnostics Runner */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5' }}>Self-Test Diagnostics</div>
                      <div style={{ fontSize: '12px', color: '#71717a' }}>Run full SQLite, vector index, and runtime validation</div>
                    </div>
                    <button
                      onClick={handleRunDiagnostics}
                      disabled={isRunningDiagnostics}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: '#27272a',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f4f4f5',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        cursor: isRunningDiagnostics ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <RefreshCw size={12} className={isRunningDiagnostics ? 'animate-spin' : ''} />
                      <span>{isRunningDiagnostics ? 'Running...' : 'Run Diagnostics'}</span>
                    </button>
                  </div>

                  {diagnosticsReport && (
                    <div style={{ backgroundColor: '#09090b', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ fontSize: '12px', color: diagnosticsReport.allPassed ? '#10b981' : '#f59e0b', fontWeight: 600, marginBottom: '6px' }}>
                        System Status: {diagnosticsReport.allPassed ? 'HEALTHY (ALL PASSED)' : 'ATTENTION REQUIRED'} ({diagnosticsReport.results.filter(r => r.status === 'PASS').length}/{diagnosticsReport.results.length} checks passed)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: '#a1a1aa' }}>
                        {diagnosticsReport.results.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{c.name}:</span>
                            <span style={{ color: c.status === 'PASS' ? '#10b981' : '#f59e0b' }}>{c.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#18181b',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '420px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#f4f4f5' }}>{confirmDialog.title}</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#a1a1aa', lineHeight: 1.5 }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  color: '#f4f4f5',
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
                  padding: '7px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
