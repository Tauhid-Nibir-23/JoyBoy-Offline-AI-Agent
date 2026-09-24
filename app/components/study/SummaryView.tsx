import React, { useState } from 'react';
import { 
  FileText, 
  Layers, 
  MessageSquare, 
  CheckCircle2, 
  BookOpen,
  Copy,
  Check
} from 'lucide-react';
import { SummaryData } from '../../../study/types';

interface SummaryViewProps {
  summary: SummaryData;
  onOpenInChat: (summary: SummaryData) => void;
  onRetry: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summary, onOpenInChat, onRetry }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `# ${summary.topic} (${summary.mode} summary)\n\n${summary.keyTakeaways?.length ? `## Key Takeaways\n${summary.keyTakeaways.map(k => `- ${k}`).join('\n')}\n\n` : ''}## Summary\n${summary.content}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card" style={{ padding: '24px', maxWidth: '820px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '14px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              background: '#334155', 
              color: '#cbd5e1', 
              padding: '2px 8px', 
              borderRadius: '4px', 
              fontSize: '11px', 
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              {summary.mode} Summary
            </span>
            {summary.isChunked && (
              <span style={{ 
                background: 'rgba(59, 130, 246, 0.2)', 
                color: '#93c5fd', 
                padding: '2px 8px', 
                borderRadius: '4px', 
                fontSize: '11px', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Layers size={11} /> {summary.chunkCount} Chunks Combined
              </span>
            )}
            <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>{summary.topic}</h3>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '7px 12px',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={() => onOpenInChat(summary)}
            style={{
              padding: '7px 14px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <MessageSquare size={14} /> Ask AI About Summary
          </button>
        </div>
      </div>

      {/* Grounding Notice if applicable */}
      {summary.groundingNotice && (
        <div style={{ 
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid rgba(245, 158, 11, 0.3)', 
          color: '#fde68a', 
          padding: '8px 12px', 
          borderRadius: '6px', 
          fontSize: '12px', 
          marginBottom: '16px' 
        }}>
          ⚠️ {summary.groundingNotice}
        </div>
      )}

      {/* Key Takeaways Callout */}
      {summary.keyTakeaways && summary.keyTakeaways.length > 0 && (
        <div style={{ 
          background: 'rgba(16, 185, 129, 0.08)', 
          border: '1px solid rgba(16, 185, 129, 0.25)', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '20px' 
        }}>
          <h4 style={{ color: '#6ee7b7', margin: '0 0 10px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} /> Key Takeaways
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }}>
            {summary.keyTakeaways.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Full Content */}
      <div 
        style={{ 
          background: '#0a0f1d', 
          border: '1px solid #1e293b', 
          borderRadius: '8px', 
          padding: '20px', 
          color: '#e2e8f0', 
          fontSize: '14px', 
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap'
        }}
      >
        {summary.content}
      </div>

      {/* Citations */}
      {summary.sources && summary.sources.length > 0 && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={13} /> Source References:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {summary.sources.map((s, idx) => (
              <span 
                key={idx}
                style={{ 
                  background: '#1e293b', 
                  border: '1px solid #334155', 
                  padding: '4px 10px', 
                  borderRadius: '4px', 
                  fontSize: '11px',
                  color: '#93c5fd'
                }}
              >
                {s.filename} (chunk {s.chunkIndex + 1}) · {Math.round(s.similarity * 100)}% match
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
