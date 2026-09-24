// Offline Study AI - Study History View (Phase 5)
import React, { useState } from 'react';
import { 
  Clock, 
  Trash2, 
  ExternalLink, 
  MessageSquare, 
  BookOpen, 
  Award, 
  Layers, 
  FileText, 
  Calendar, 
  Lightbulb,
  Search,
  Filter
} from 'lucide-react';
import { StudySession, StudyActionType } from '../../../study/types';

interface StudyHistoryViewProps {
  history: StudySession[];
  onOpenSession: (session: StudySession) => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function getTypeBadge(type: StudyActionType) {
  switch (type) {
    case 'quiz':
      return { label: 'Quiz', icon: <Award size={13} />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    case 'flashcards':
      return { label: 'Flashcards', icon: <Layers size={13} />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
    case 'summarize':
      return { label: 'Summary', icon: <FileText size={13} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    case 'notes':
      return { label: 'Notes', icon: <BookOpen size={13} />, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' };
    case 'explain':
      return { label: 'Explain', icon: <Lightbulb size={13} />, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' };
    case 'plan':
      return { label: 'Study Plan', icon: <Calendar size={13} />, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' };
    default:
      return { label: type, icon: <Clock size={13} />, color: '#94a3b8', bg: '#1e293b' };
  }
}

export const StudyHistoryView: React.FC<StudyHistoryViewProps> = ({
  history,
  onOpenSession,
  onDeleteSession,
  onClearAll
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = history.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTopic = item.topic.toLowerCase().includes(q);
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDoc = item.documentName ? item.documentName.toLowerCase().includes(q) : false;
      return matchTopic || matchTitle || matchDoc;
    }
    return true;
  });

  return (
    <div className="card" style={{ padding: '24px', maxWidth: '880px', margin: '0 auto' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#f59e0b' }} /> Study History
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            {history.length} saved study sessions stored locally on your device.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear your study history?')) {
                onClearAll();
              }
            }}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Trash2 size={13} /> Clear History
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search topic or document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '13px'
            }}
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '8px 12px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#f8fafc',
            fontSize: '13px'
          }}
        >
          <option value="all">All Types</option>
          <option value="quiz">Quizzes</option>
          <option value="flashcards">Flashcards</option>
          <option value="summarize">Summaries</option>
          <option value="notes">Notes</option>
          <option value="explain">Explanations</option>
          <option value="plan">Study Plans</option>
        </select>
      </div>

      {/* History Items List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          <Clock size={36} style={{ color: '#475569', margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#cbd5e1' }}>No study history items found</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>
            Generate quizzes, flashcards, notes, or summaries to build your offline study library.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((item) => {
            const badge = getTypeBadge(item.type);
            return (
              <div
                key={item.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      background: badge.bg,
                      color: badge.color,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {badge.icon} {badge.label}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                      {item.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>{formatDate(item.createdAt)}</span>
                    {item.documentName && (
                      <span style={{ color: '#93c5fd' }}>📄 {item.documentName}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => onOpenSession(item)}
                    style={{
                      padding: '6px 12px',
                      background: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <ExternalLink size={13} /> Open
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${item.title}"?`)) {
                        onDeleteSession(item.id);
                      }
                    }}
                    title="Delete item"
                    style={{
                      padding: '6px 8px',
                      background: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
