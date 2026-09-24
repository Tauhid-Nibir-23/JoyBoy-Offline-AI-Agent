// Offline Study AI - Study Plan View (Phase 5)
import React from 'react';
import { 
  Calendar, 
  Clock, 
  CheckSquare, 
  RotateCcw, 
  MessageSquare, 
  AlertTriangle,
  BookOpen
} from 'lucide-react';
import { StudyPlanData } from '../../../study/types';

interface StudyPlanViewProps {
  plan: StudyPlanData;
  onOpenInChat: (plan: StudyPlanData) => void;
  onRetry: () => void;
}

export const StudyPlanView: React.FC<StudyPlanViewProps> = ({ plan, onOpenInChat, onRetry }) => {
  return (
    <div className="card" style={{ padding: '24px', maxWidth: '880px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
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
              Study Plan
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>{plan.subject}</h3>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#94a3b8' }}>
            <span><strong>{plan.days}</strong> Days</span>
            <span><strong>{plan.hoursPerDay}</strong> Hours/Day</span>
            {plan.examDate && <span>Target Exam: <strong style={{ color: '#ffedd5' }}>{plan.examDate}</strong></span>}
          </div>
        </div>

        <button
          onClick={() => onOpenInChat(plan)}
          style={{
            padding: '8px 16px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          <MessageSquare size={15} /> Modify Plan in Chat
        </button>
      </div>

      {/* Safety / Grounding Notice */}
      <div style={{ 
        background: 'rgba(245, 158, 11, 0.1)', 
        border: '1px solid rgba(245, 158, 11, 0.3)', 
        color: '#fde68a', 
        padding: '10px 14px', 
        borderRadius: '6px', 
        fontSize: '12px', 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <span>{plan.disclaimer}</span>
      </div>

      {/* Daily Schedule Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {plan.schedule.map((item) => (
          <div 
            key={item.day}
            style={{ 
              background: '#0f172a', 
              border: '1px solid #1e293b', 
              borderRadius: '8px', 
              padding: '16px' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ 
                  background: '#f59e0b', 
                  color: '#0f172a', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '12px', 
                  fontWeight: 700 
                }}>
                  Day {item.day}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>{item.topic}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '12px' }}>
                <Clock size={13} /> {item.estimatedDuration}
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '8px', lineHeight: 1.5 }}>
              <strong style={{ color: '#93c5fd' }}>Activity:</strong> {item.activity}
            </div>

            <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckSquare size={13} style={{ color: '#10b981' }} />
              <span><strong>Revision Task:</strong> {item.revisionTask}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
