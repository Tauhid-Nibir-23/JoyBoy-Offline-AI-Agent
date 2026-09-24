// Offline Study AI - Study Notes View (Phase 5)
import React, { useState } from 'react';
import { 
  FileText, 
  Copy, 
  Check, 
  MessageSquare, 
  BookOpen, 
  ExternalLink 
} from 'lucide-react';
import { NotesData } from '../../../study/types';

interface NotesViewProps {
  notes: NotesData;
  onOpenInChat: (notes: NotesData) => void;
  onRetry: () => void;
}

export const NotesView: React.FC<NotesViewProps> = ({ notes, onOpenInChat, onRetry }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(notes.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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
            Study Notes
          </span>
          <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '15px' }}>{notes.topic}</span>
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
            {copied ? 'Copied!' : 'Copy Notes'}
          </button>

          <button
            onClick={() => onOpenInChat(notes)}
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
            <MessageSquare size={14} /> Continue in Chat
          </button>
        </div>
      </div>

      {/* Grounding Notice if applicable */}
      {notes.groundingNotice && (
        <div style={{ 
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid rgba(245, 158, 11, 0.3)', 
          color: '#fde68a', 
          padding: '8px 12px', 
          borderRadius: '6px', 
          fontSize: '12px', 
          marginBottom: '16px' 
        }}>
          ⚠️ {notes.groundingNotice}
        </div>
      )}

      {/* Markdown Notes Content */}
      <div 
        style={{ 
          background: '#0a0f1d', 
          border: '1px solid #1e293b', 
          borderRadius: '8px', 
          padding: '20px', 
          color: '#e2e8f0', 
          fontSize: '14px', 
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit'
        }}
      >
        {notes.markdown}
      </div>

      {/* Source Citations */}
      {notes.sources && notes.sources.length > 0 && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={13} /> Grounded Sources:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {notes.sources.map((s, idx) => (
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
