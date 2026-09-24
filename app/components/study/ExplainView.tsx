// Offline Study AI - Explain View (Phase 5)
import React from 'react';
import { 
  Lightbulb, 
  Cpu, 
  Layers, 
  Code, 
  GraduationCap, 
  MessageSquare, 
  BookOpen 
} from 'lucide-react';
import { ExplainData } from '../../../study/types';

interface ExplainViewProps {
  explain: ExplainData;
  onOpenInChat: (explain: ExplainData) => void;
  onRetry: () => void;
}

export const ExplainView: React.FC<ExplainViewProps> = ({ explain, onOpenInChat, onRetry }) => {
  return (
    <div className="card" style={{ padding: '24px', maxWidth: '820px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '14px', marginBottom: '18px' }}>
        <div>
          <span style={{ 
            background: '#334155', 
            color: '#cbd5e1', 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontSize: '11px', 
            fontWeight: 600,
            textTransform: 'uppercase',
            marginRight: '8px'
          }}>
            Explain
          </span>
          <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '15px' }}>{explain.topic}</span>
        </div>

        <button
          onClick={() => onOpenInChat(explain)}
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
          <MessageSquare size={14} /> Ask Follow-up in Chat
        </button>
      </div>

      {/* Grounding Notice if applicable */}
      {explain.groundingNotice && (
        <div style={{ 
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid rgba(245, 158, 11, 0.3)', 
          color: '#fde68a', 
          padding: '8px 12px', 
          borderRadius: '6px', 
          fontSize: '12px', 
          marginBottom: '16px' 
        }}>
          ⚠️ {explain.groundingNotice}
        </div>
      )}

      {/* Structured Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Simple Definition */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
          <h4 style={{ color: '#6ee7b7', margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lightbulb size={16} /> Simple Definition
          </h4>
          <div style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {explain.definition}
          </div>
        </div>

        {/* How It Works */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
          <h4 style={{ color: '#93c5fd', margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={16} /> How It Works
          </h4>
          <div style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {explain.howItWorks}
          </div>
        </div>

        {/* Important Components */}
        {explain.components && explain.components.length > 0 && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ color: '#fde68a', margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} /> Important Components
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }}>
              {explain.components.map((comp, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{comp}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Concrete Example */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
          <h4 style={{ color: '#f472b6', margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Code size={16} /> Concrete Example
          </h4>
          <div style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {explain.example}
          </div>
        </div>

        {/* Exam-Focused Points */}
        {explain.examPoints && explain.examPoints.length > 0 && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ color: '#fb923c', margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GraduationCap size={16} /> Exam-Focused Points
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }}>
              {explain.examPoints.map((pt, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{pt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Citations */}
      {explain.sources && explain.sources.length > 0 && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={13} /> Source References:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {explain.sources.map((s, idx) => (
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
