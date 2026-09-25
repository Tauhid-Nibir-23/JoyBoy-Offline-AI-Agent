import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Layers, 
  Folder, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Monitor, 
  Sliders,
  Sparkles,
  Info,
  Power,
  Zap,
  Gauge
} from 'lucide-react';
import { detectHardware, HardwareProfile, formatBytes } from '../../../core/environment/hardware';
import { modelManager } from '../../../models/manager';
import { ModelProfile } from '../../../models/types';
import { chatService } from '../../../ai/chatService';
import { localAIEngine } from '../../../ai/localEngine';
import { globalStatus } from '../../../core/status';

export function ModelManagerView() {
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [loadingHardware, setLoadingHardware] = useState(false);

  const [models, setModels] = useState<ModelProfile[]>([]);
  const [modelDir, setModelDir] = useState<string>('./models');
  const [isScanning, setIsScanning] = useState(false);
  const [activeModel, setActiveModel] = useState<ModelProfile | null>(null);
  const [engineStatus, setEngineStatus] = useState(localAIEngine.getStatus());
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [providerType, setProviderType] = useState<'auto' | 'mock' | 'llamacpp'>('auto');
  const [activeProviderName, setActiveProviderName] = useState<string>('Mock Study Assistant');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadHardware();
    loadModelsAndSettings();
  }, []);

  const loadHardware = async () => {
    setLoadingHardware(true);
    try {
      const hw = await detectHardware();
      setHardware(hw);
    } catch {
      // hardware detection fallback
    } finally {
      setLoadingHardware(false);
    }
  };

  const loadModelsAndSettings = async () => {
    setIsScanning(true);
    try {
      await modelManager.initialize();
      setModelDir(modelManager.getModelDirectory());
      const registered = await modelManager.scanModels();
      setModels(registered);
      const active = modelManager.getActiveModel();
      setActiveModel(active);

      const pType = chatService.getProviderType();
      setProviderType(pType);
      const pName = await chatService.getProviderName();
      setActiveProviderName(pName);

      const status = localAIEngine.getStatus();
      setEngineStatus(status);
      globalStatus.setModelStatus(status.isServerRunning ? 'Loaded' : 'Not Loaded', active?.name);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setFeedbackMsg(null);
    try {
      const updated = await modelManager.scanModels();
      setModels(updated);
      const active = modelManager.getActiveModel();
      setActiveModel(active);
      const status = localAIEngine.getStatus();
      setEngineStatus(status);
      const pName = await chatService.getProviderName();
      setActiveProviderName(pName);
      setFeedbackMsg({ 
        type: 'success', 
        text: `Scanned directory: Found ${updated.filter(m => m.status !== 'Not Installed').length} installed GGUF model(s).` 
      });
    } catch (e: any) {
      setFeedbackMsg({ type: 'error', text: `Scan failed: ${e.message}` });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveDirectory = async () => {
    setFeedbackMsg(null);
    try {
      await modelManager.setModelDirectory(modelDir);
      await handleScan();
      setFeedbackMsg({ type: 'success', text: `Model directory updated to "${modelDir}" and scanned.` });
    } catch (e: any) {
      setFeedbackMsg({ type: 'error', text: e.message });
    }
  };

  const handleSelectModel = async (modelId: string) => {
    setFeedbackMsg(null);
    const success = await modelManager.selectActiveModel(modelId);
    if (success) {
      const updated = modelManager.getRegisteredModels();
      setModels(updated);
      const active = modelManager.getActiveModel();
      setActiveModel(active);
      const status = localAIEngine.getStatus();
      setEngineStatus(status);
      const pName = await chatService.getProviderName();
      setActiveProviderName(pName);
      globalStatus.setModelStatus(status.isServerRunning ? 'Loaded' : 'Not Loaded', active?.name);
      setFeedbackMsg({ type: 'success', text: `Active model set to "${active?.name}".` });
    } else {
      setFeedbackMsg({ 
        type: 'error', 
        text: 'Failed to select model: File not found or failed GGUF header validation.' 
      });
    }
  };

  const handleLoadModel = async (modelPath?: string) => {
    const path = modelPath || activeModel?.path;
    if (!path) {
      setFeedbackMsg({ type: 'error', text: 'No model path available to load.' });
      return;
    }
    setIsActionLoading(true);
    setFeedbackMsg(null);
    try {
      const ok = await localAIEngine.loadModel(path);
      const status = localAIEngine.getStatus();
      setEngineStatus(status);
      if (ok) {
        globalStatus.setModelStatus('Loaded', activeModel?.name);
        setFeedbackMsg({ 
          type: 'success', 
          text: `Model successfully loaded into llama-server (Port ${status.serverPort || 8088}).` 
        });
      } else {
        setFeedbackMsg({ 
          type: 'error', 
          text: 'Failed to start llama-server. Verify binary in ./bin and model compatibility.' 
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: `Load error: ${err.message}` });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnloadModel = async () => {
    setIsActionLoading(true);
    setFeedbackMsg(null);
    try {
      await localAIEngine.unloadModel();
      const status = localAIEngine.getStatus();
      setEngineStatus(status);
      globalStatus.setModelStatus('Not Loaded');
      setFeedbackMsg({ type: 'info', text: 'Model unloaded and llama-server process stopped.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: `Unload error: ${err.message}` });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnregister = (modelId: string) => {
    modelManager.unregisterModel(modelId);
    const updated = modelManager.getRegisteredModels();
    setModels(updated);
    setActiveModel(modelManager.getActiveModel());
    setFeedbackMsg({ type: 'info', text: 'Model registration removed.' });
  };

  const handleProviderChange = async (type: 'auto' | 'mock' | 'llamacpp') => {
    chatService.setProviderType(type);
    setProviderType(type);
    const name = await chatService.getProviderName();
    setActiveProviderName(name);
    setFeedbackMsg({ type: 'info', text: `AI Provider mode set to: ${type.toUpperCase()}` });
  };

  const speedTokSec = chatService.getLastSpeed();
  const baselineModel = models.find(m => m.id === 'qwen3-4b-q4_k_m') || models[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto', paddingBottom: '30px' }}>
      
      {/* Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fef3c7', margin: 0 }}>
            Model Management & Inference Engine
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Manage local GGUF models, memory loading, inference speed, and local hardware profiles · 100% Offline
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleScan}
            disabled={isScanning}
            className="btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: '#1e293b', 
              color: '#f8fafc', 
              border: '1px solid #334155',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
            <span>Scan Models</span>
          </button>
          
          <button 
            onClick={() => { loadHardware(); loadModelsAndSettings(); }}
            className="btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: '#0f172a', 
              color: '#f8fafc', 
              border: '1px solid #334155',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={isScanning || loadingHardware ? 'animate-spin' : ''} />
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          backgroundColor: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : feedbackMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${feedbackMsg.type === 'success' ? '#10b981' : feedbackMsg.type === 'error' ? '#ef4444' : '#3b82f6'}`,
          color: feedbackMsg.type === 'success' ? '#6ee7b7' : feedbackMsg.type === 'error' ? '#fca5a5' : '#93c5fd'
        }}>
          {feedbackMsg.text}
        </div>
      )}

      {/* 1. Active Model Spotlight & Control Card */}
      <div className="card" style={{ 
        padding: '22px', 
        border: activeModel ? '1px solid rgba(217, 119, 6, 0.5)' : '1px solid #334155',
        backgroundColor: 'rgba(12, 18, 30, 0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Zap size={16} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f59e0b', fontWeight: 700 }}>
                Active Inference Model
              </span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fef3c7', margin: 0 }}>
              {activeModel ? activeModel.name : 'No Active Model Selected'}
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 0 0' }}>
              {activeModel ? activeModel.description : 'Select a local GGUF model below to activate local AI inference.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Loaded Status Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: engineStatus.isServerRunning ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
              border: `1px solid ${engineStatus.isServerRunning ? '#10b981' : '#475569'}`,
              color: engineStatus.isServerRunning ? '#6ee7b7' : '#94a3b8'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: engineStatus.isServerRunning ? '#10b981' : '#64748b'
              }}></span>
              <span>{engineStatus.isServerRunning ? `Server Running (Port ${engineStatus.serverPort || 8088})` : 'Not Loaded in Memory'}</span>
            </div>

            {/* Load / Unload Buttons */}
            {activeModel?.path && (
              engineStatus.isServerRunning ? (
                <button
                  onClick={handleUnloadModel}
                  disabled={isActionLoading}
                  className="btn"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  <Power size={14} />
                  <span>Unload Model</span>
                </button>
              ) : (
                <button
                  onClick={() => handleLoadModel()}
                  disabled={isActionLoading || activeModel.status === 'Not Installed'}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#fff',
                    cursor: activeModel.status !== 'Not Installed' ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  <Zap size={14} />
                  <span>Load Model</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Active Model Specs Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginTop: '18px',
          backgroundColor: '#070b14',
          padding: '14px',
          borderRadius: '8px',
          border: '1px solid #1e293b',
          fontSize: '12.5px'
        }}>
          <div>
            <span style={{ color: '#94a3b8' }}>Quantization: </span>
            <strong style={{ color: '#f8fafc' }}>{activeModel?.quantization || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Format: </span>
            <strong style={{ color: '#f8fafc' }}>{activeModel?.format || 'GGUF'}</strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>File Size: </span>
            <strong style={{ color: '#f8fafc' }}>
              {activeModel?.expectedSize ? formatBytes(activeModel.expectedSize) : '—'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Context Length: </span>
            <strong style={{ color: '#f8fafc' }}>
              {activeModel?.contextLength ? `${activeModel.contextLength} tokens` : '4096 tokens'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Approx Speed: </span>
            <strong style={{ color: speedTokSec ? '#38bdf8' : '#cbd5e1' }}>
              {speedTokSec ? `${speedTokSec} tok/s` : '— (Benchmark on chat)'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Availability: </span>
            <span style={{
              fontWeight: 600,
              color: activeModel?.status === 'Ready' || activeModel?.status === 'Installed' ? '#10b981' : '#f59e0b'
            }}>
              {activeModel?.status || 'None'}
            </span>
          </div>
          <div style={{ gridColumn: '1 / -1', wordBreak: 'break-all' }}>
            <span style={{ color: '#94a3b8' }}>Path: </span>
            <code style={{ color: activeModel?.path ? '#6ee7b7' : '#64748b', fontSize: '12px' }}>
              {activeModel?.path || 'None'}
            </code>
          </div>
        </div>
      </div>

      {/* 2. Provider Selection & Status Bar */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Sliders size={18} style={{ color: '#38bdf8' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
            Inference Provider
          </h3>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['auto', 'mock', 'llamacpp'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleProviderChange(type)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: providerType === type ? '1px solid #d97706' : '1px solid #334155',
                  backgroundColor: providerType === type ? 'rgba(180, 83, 9, 0.4)' : '#0f172a',
                  color: providerType === type ? '#fef3c7' : '#94a3b8'
                }}
              >
                {type === 'auto' ? 'Auto Detect' : type === 'mock' ? 'Mock Provider' : 'Local llama.cpp'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#94a3b8' }}>Active Provider: </span>
              <strong style={{ color: '#38bdf8' }}>{activeProviderName}</strong>
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '4px 10px', 
              borderRadius: '20px',
              backgroundColor: engineStatus.available ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${engineStatus.available ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: engineStatus.available ? '#6ee7b7' : '#fca5a5'
            }}>
              <span style={{ 
                width: '7px', 
                height: '7px', 
                borderRadius: '50%', 
                backgroundColor: engineStatus.available ? '#10b981' : '#ef4444' 
              }}></span>
              <span>Model Available: {engineStatus.available ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Model Directory Configuration */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Folder size={18} style={{ color: '#d97706' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
            Model Directory
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            value={modelDir}
            onChange={(e) => setModelDir(e.target.value)}
            placeholder="e.g. ./models or D:\Models"
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: '#090d16',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleSaveDirectory}
            className="btn"
            style={{ backgroundColor: '#334155', color: '#f8fafc', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}
          >
            Save Path
          </button>
        </div>
      </div>

      {/* 4. Registered & Detected Models Table */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: '#a855f7' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
              Available Local Models
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {models.filter(m => m.status === 'Ready' || m.status === 'Installed' || m.status === 'Active').length} installed · {models.filter(m => m.status === 'Not Installed').length} not installed
          </span>
        </div>

        {models.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
            No models registered. Scan a directory containing <code>.gguf</code> models.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {models.map((m) => {
              const isActive = activeModel?.id === m.id && (m.status === 'Ready' || m.status === 'Installed' || m.status === 'Active');
              const isInstalled = m.status === 'Ready' || m.status === 'Installed' || m.status === 'Active';
              const isNotInstalled = m.status === 'Not Installed';
              const isMissing = m.status === 'Missing';

              return (
                <div
                  key={m.id}
                  style={{
                    backgroundColor: '#090d16',
                    border: isActive ? '1px solid #10b981' : isNotInstalled ? '1px solid #1e293b' : '1px solid #334155',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{m.name}</strong>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: '#1e293b', 
                        color: '#94a3b8' 
                      }}>
                        {m.quantization} · {m.format}
                      </span>

                      {/* Hardware / Role Badges */}
                      {m.isRecommended && (
                        <span style={{
                          fontSize: '10.5px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          fontWeight: 600
                        }}>
                          ⭐ RECOMMENDED FOR THIS PC
                        </span>
                      )}

                      {m.isFallback && (
                        <span style={{
                          fontSize: '10.5px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          fontWeight: 600
                        }}>
                          FALLBACK (0.5B)
                        </span>
                      )}

                      {m.isHeavy && (
                        <span style={{
                          fontSize: '10.5px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontWeight: 600
                        }}>
                          ⚠ HEAVY (NOT RECOMMENDED)
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {m.description || `Expected size: ${formatBytes(m.expectedSize)} · Recommended RAM: ${m.recommendedRamGb || 8} GB`}
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                      File: <code>{m.fileName}</code> {m.path ? `(${m.path})` : isMissing ? '— (Previously set file missing)' : '— (Not downloaded)'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Status Badge clearly distinguishing: ACTIVE, INSTALLED, NOT INSTALLED, MISSING */}
                    {(() => {
                      if (isActive) {
                        return (
                          <span style={{
                            padding: '4px 9px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            color: '#6ee7b7',
                            border: '1px solid #10b981',
                            letterSpacing: '0.4px'
                          }}>
                            ACTIVE
                          </span>
                        );
                      }
                      if (isInstalled) {
                        return (
                          <span style={{
                            padding: '4px 9px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            color: '#93c5fd',
                            border: '1px solid #3b82f6',
                            letterSpacing: '0.4px'
                          }}>
                            INSTALLED
                          </span>
                        );
                      }
                      if (isMissing) {
                        return (
                          <span style={{
                            padding: '4px 9px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#fca5a5',
                            border: '1px solid #ef4444',
                            letterSpacing: '0.4px'
                          }}>
                            MISSING
                          </span>
                        );
                      }
                      return (
                        <span style={{
                          padding: '4px 9px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'rgba(100, 116, 139, 0.2)',
                          color: '#94a3b8',
                          border: '1px solid #475569',
                          letterSpacing: '0.4px'
                        }}>
                          NOT INSTALLED
                        </span>
                      );
                    })()}

                    {/* Action buttons */}
                    {isNotInstalled && (
                      <button
                        onClick={async () => {
                          const res = await modelManager.installModel(m.id);
                          setFeedbackMsg({
                            type: res.success ? 'info' : 'error',
                            text: res.message
                          });
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #f59e0b',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          color: '#fbbf24',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="Install or obtain this model"
                      >
                        Install Model
                      </button>
                    )}

                    {isInstalled && !isActive && (
                      <button
                        onClick={() => handleSelectModel(m.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #2563eb',
                          backgroundColor: '#1d4ed8',
                          color: '#fff',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Use Model
                      </button>
                    )}

                    {isInstalled && isActive && !engineStatus.isServerRunning && (
                      <button
                        onClick={() => handleLoadModel(m.path)}
                        disabled={isActionLoading}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #10b981',
                          backgroundColor: '#059669',
                          color: '#fff',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Load Server
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Detected Hardware Profile */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Monitor size={18} style={{ color: '#f59e0b' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
            Hardware Acceleration Profile
          </h3>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
          gap: '14px', 
          fontSize: '13px' 
        }}>
          <div style={{ backgroundColor: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Operating System</span>
            <strong style={{ color: '#f8fafc' }}>{hardware?.os || 'Detecting...'}</strong>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Arch: {hardware?.architecture || 'x64'}</div>
          </div>

          <div style={{ backgroundColor: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>CPU Processor</span>
            <strong style={{ color: '#f8fafc', wordBreak: 'break-word' }}>{hardware?.cpu || 'Detecting...'}</strong>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {hardware ? `${hardware.logicalCores} Logical Threads${hardware.physicalCores ? ` (${hardware.physicalCores} Cores)` : ''}` : '—'}
            </div>
          </div>

          <div style={{ backgroundColor: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>RAM (System Memory)</span>
            <strong style={{ color: '#f8fafc' }}>
              {hardware ? formatBytes(hardware.totalRamBytes) : 'Detecting...'} Total
            </strong>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {hardware?.availableRamBytes ? `${formatBytes(hardware.availableRamBytes)} Available` : 'Available: Unknown'}
            </div>
          </div>

          <div style={{ backgroundColor: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>GPU & VRAM</span>
            <strong style={{ color: '#f8fafc', wordBreak: 'break-word' }}>{hardware?.gpu || 'Unknown'}</strong>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              VRAM: {hardware?.vramBytes ? formatBytes(hardware.vramBytes) : 'Unknown'}
              {hardware?.gpuVendor ? ` · ${hardware.gpuVendor}` : ''}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
