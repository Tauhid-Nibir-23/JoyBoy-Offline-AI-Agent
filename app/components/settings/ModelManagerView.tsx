import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Layers, 
  Folder, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Monitor, 
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import { detectHardware, HardwareProfile, formatBytes } from '../../../core/environment/hardware';
import { modelManager } from '../../../models/manager';
import { ModelProfile } from '../../../models/types';
import { chatService } from '../../../ai/chatService';
import { localAIEngine } from '../../../ai/localEngine';

export function ModelManagerView() {
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [loadingHardware, setLoadingHardware] = useState(false);

  const [models, setModels] = useState<ModelProfile[]>([]);
  const [modelDir, setModelDir] = useState<string>('./models');
  const [isScanning, setIsScanning] = useState(false);
  const [activeModel, setActiveModel] = useState<ModelProfile | null>(null);
  const [engineStatus, setEngineStatus] = useState(localAIEngine.getStatus());

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

      setEngineStatus(localAIEngine.getStatus());
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
      setEngineStatus(localAIEngine.getStatus());
      const pName = await chatService.getProviderName();
      setActiveProviderName(pName);
      setFeedbackMsg({ type: 'success', text: `Scanned directory: Found ${updated.filter(m => m.status !== 'Not Installed').length} installed GGUF model(s).` });
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
      setEngineStatus(localAIEngine.getStatus());
      const pName = await chatService.getProviderName();
      setActiveProviderName(pName);
      setFeedbackMsg({ type: 'success', text: `Active model set to "${active?.name}".` });
    } else {
      setFeedbackMsg({ 
        type: 'error', 
        text: 'Failed to select model: File not found or failed GGUF header validation.' 
      });
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

  const baselineModel = models.find(m => m.id === 'qwen3-4b-q4_k_m') || models[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fef3c7', margin: 0 }}>
            Hardware Detection & Local Model Manager
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Phase 2A — Manage local GGUF models, hardware acceleration profiles, and AI inference providers.
          </p>
        </div>

        <button 
          onClick={() => { loadHardware(); handleScan(); }}
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
          <RefreshCw size={14} className={isScanning || loadingHardware ? 'animate-spin' : ''} />
          <span>Refresh All</span>
        </button>
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

      {/* 1. Hardware Detection Section */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Monitor size={18} style={{ color: '#f59e0b' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
            Detected Hardware Profile
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

      {/* 2. Provider Selection & Status Bar */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Sliders size={18} style={{ color: '#38bdf8' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
            AI Provider Selection & Engine Status
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

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '4px 10px', 
              borderRadius: '20px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fde68a'
            }}>
              <span>AI Engine: {engineStatus.busy ? 'Generating...' : engineStatus.available ? 'Ready' : 'Idle'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recommended Baseline Model Card */}
      {baselineModel && (
        <div className="card" style={{ padding: '20px', border: '1px solid rgba(217, 119, 6, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Sparkles size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#f59e0b', fontWeight: 600 }}>
                  Recommended Local Baseline Model
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fef3c7', margin: 0 }}>
                {baselineModel.name}
              </h3>
              <p style={{ fontSize: '13px', color: '#cbd5e1', margin: '6px 0 0 0', maxWidth: '600px' }}>
                {baselineModel.description}
              </p>
            </div>

            {/* Status Pill */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '6px 14px', 
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: baselineModel.status === 'Ready' 
                ? 'rgba(16, 185, 129, 0.2)' 
                : baselineModel.status === 'Installed' 
                ? 'rgba(59, 130, 246, 0.2)' 
                : 'rgba(245, 158, 11, 0.15)',
              color: baselineModel.status === 'Ready' 
                ? '#6ee7b7' 
                : baselineModel.status === 'Installed' 
                ? '#93c5fd' 
                : '#fde68a',
              border: `1px solid ${
                baselineModel.status === 'Ready' ? '#10b981' : baselineModel.status === 'Installed' ? '#3b82f6' : '#d97706'
              }`
            }}>
              {baselineModel.status === 'Ready' && <CheckCircle2 size={14} />}
              {baselineModel.status === 'Installed' && <Info size={14} />}
              {baselineModel.status === 'Not Installed' && <AlertTriangle size={14} />}
              <span>Status: {baselineModel.status}</span>
            </div>
          </div>

          {/* Model Specs */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
            gap: '12px', 
            marginTop: '16px',
            backgroundColor: '#090d16',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #1e293b',
            fontSize: '12.5px'
          }}>
            <div>
              <span style={{ color: '#94a3b8' }}>Format: </span>
              <strong style={{ color: '#f8fafc' }}>{baselineModel.format}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Quantization: </span>
              <strong style={{ color: '#f8fafc' }}>{baselineModel.quantization}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Expected File: </span>
              <strong style={{ color: '#f8fafc' }}>{baselineModel.fileName}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Target RAM: </span>
              <strong style={{ color: '#f8fafc' }}>{baselineModel.recommendedRamGb || 8} GB</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Location: </span>
              <span style={{ color: baselineModel.path ? '#6ee7b7' : '#64748b' }}>
                {baselineModel.path || '— (Place GGUF in models directory)'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            {baselineModel.status === 'Installed' && (
              <button
                onClick={() => handleSelectModel(baselineModel.id)}
                className="btn btn-primary"
                style={{ backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px' }}
              >
                Set as Active Model
              </button>
            )}
            {baselineModel.status === 'Not Installed' && (
              <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} style={{ color: '#38bdf8' }} />
                <span>To use this model, place <code>{baselineModel.fileName}</code> into your configured models folder and click Scan.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Model Directory Configuration */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Folder size={18} style={{ color: '#d97706' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
            Model Directory & Scanner
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
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="btn btn-primary"
            style={{ backgroundColor: '#d97706', color: '#fff', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
            <span>Scan Models</span>
          </button>
        </div>
      </div>

      {/* 5. Registered & Detected Models Table */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Layers size={18} style={{ color: '#a855f7' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffedd5', margin: 0 }}>
            Registered Models in System
          </h3>
        </div>

        {models.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
            No models registered. Scan a directory containing <code>.gguf</code> models.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {models.map((m) => {
              const isActive = activeModel?.id === m.id && (m.status === 'Ready' || m.status === 'Installed');
              return (
                <div
                  key={m.id}
                  style={{
                    backgroundColor: '#090d16',
                    border: isActive ? '1px solid #10b981' : '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      {isActive && (
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          backgroundColor: 'rgba(16, 185, 129, 0.2)', 
                          color: '#6ee7b7',
                          border: '1px solid #10b981'
                        }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      File: <code>{m.fileName}</code> {m.path ? `(${m.path})` : '— (File missing)'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: m.status === 'Ready' || m.status === 'Installed' ? '#6ee7b7' : m.status === 'Error' ? '#fca5a5' : '#fde68a',
                      fontWeight: 500
                    }}>
                      {m.status}
                    </div>

                    {m.status === 'Installed' && (
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
                        Select
                      </button>
                    )}

                    {m.id !== 'qwen3-4b-q4_k_m' && (
                      <button
                        onClick={() => handleUnregister(m.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          backgroundColor: 'transparent',
                          color: '#94a3b8',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
