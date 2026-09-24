// Offline Study AI - Interactive Quiz View (Phase 5)
import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  RotateCcw, 
  MessageSquare, 
  FileText, 
  Award,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { QuizData, QuizQuestion } from '../../../study/types';

interface QuizViewProps {
  quiz: QuizData;
  onOpenInChat: (quiz: QuizData) => void;
  onRetry: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ quiz, onOpenInChat, onRetry }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string | number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [showFinalResults, setShowFinalResults] = useState(false);

  const currentQ: QuizQuestion | undefined = quiz.questions[currentIndex];
  const isLastQuestion = currentIndex === quiz.questions.length - 1;

  const handleSelectOption = (idx: number, optValue: string | number) => {
    if (submitted[currentIndex]) return;
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: optValue }));
  };

  const handleSubmitAnswer = () => {
    if (userAnswers[currentIndex] === undefined) return;
    setSubmitted((prev) => ({ ...prev, [currentIndex]: true }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowFinalResults(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Calculate score
  const calculateScore = () => {
    let correct = 0;
    quiz.questions.forEach((q, idx) => {
      const uAns = userAnswers[idx];
      if (uAns !== undefined) {
        if (q.type === 'mcq') {
          // Compare both index or direct string
          const correctIdx = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseInt(String(q.correctAnswer), 10);
          if (uAns === correctIdx || uAns === q.options[correctIdx] || String(uAns) === String(q.correctAnswer)) {
            correct++;
          }
        } else if (q.type === 'true_false') {
          if (String(uAns).toLowerCase() === String(q.correctAnswer).toLowerCase()) {
            correct++;
          }
        } else {
          // Short answer: marked completed
          if (String(uAns).trim().length > 0) correct++;
        }
      }
    });
    return { correct, total: quiz.questions.length };
  };

  const isCurrentCorrect = () => {
    if (!currentQ || userAnswers[currentIndex] === undefined) return false;
    const uAns = userAnswers[currentIndex];
    if (currentQ.type === 'mcq') {
      const correctIdx = typeof currentQ.correctAnswer === 'number' ? currentQ.correctAnswer : parseInt(String(currentQ.correctAnswer), 10);
      return uAns === correctIdx || uAns === currentQ.options[correctIdx] || String(uAns) === String(currentQ.correctAnswer);
    }
    if (currentQ.type === 'true_false') {
      return String(uAns).toLowerCase() === String(currentQ.correctAnswer).toLowerCase();
    }
    return true;
  };

  const score = calculateScore();

  if (showFinalResults) {
    const pct = Math.round((score.correct / score.total) * 100);
    return (
      <div className="card" style={{ padding: '24px', maxWidth: '780px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Award size={48} style={{ color: pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444', margin: '0 auto 12px auto' }} />
          <h2 style={{ fontSize: '22px', color: '#f8fafc', fontWeight: 700 }}>Quiz Completed!</h2>
          <p style={{ color: '#94a3b8', marginTop: '6px' }}>Topic: <strong style={{ color: '#ffedd5' }}>{quiz.topic}</strong></p>
          
          <div style={{ 
            fontSize: '36px', 
            fontWeight: 800, 
            marginTop: '16px', 
            color: pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171' 
          }}>
            {score.correct} / {score.total} ({pct}%)
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
            <button
              onClick={() => {
                setUserAnswers({});
                setSubmitted({});
                setCurrentIndex(0);
                setShowFinalResults(false);
              }}
              style={{
                padding: '9px 18px',
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px'
              }}
            >
              <RotateCcw size={15} /> Retake Quiz
            </button>

            <button
              onClick={() => onOpenInChat(quiz)}
              style={{
                padding: '9px 18px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <MessageSquare size={15} /> Discuss this Quiz in Chat
            </button>
          </div>
        </div>

        {/* Review list */}
        <div style={{ marginTop: '28px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
          <h4 style={{ color: '#e2e8f0', marginBottom: '14px', fontSize: '15px' }}>Question Review</h4>
          {quiz.questions.map((q, idx) => {
            const uAns = userAnswers[idx];
            let isCorrect = false;
            if (q.type === 'mcq') {
              const cIdx = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseInt(String(q.correctAnswer), 10);
              isCorrect = uAns === cIdx || uAns === q.options[cIdx] || String(uAns) === String(q.correctAnswer);
            } else if (q.type === 'true_false') {
              isCorrect = String(uAns).toLowerCase() === String(q.correctAnswer).toLowerCase();
            } else {
              isCorrect = true;
            }

            return (
              <div 
                key={q.id || idx} 
                style={{ 
                  background: '#0f172a', 
                  border: '1px solid #1e293b', 
                  borderRadius: '6px', 
                  padding: '14px', 
                  marginBottom: '10px' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  {isCorrect ? (
                    <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                  ) : (
                    <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                  )}
                  <div>
                    <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '13px' }}>
                      {idx + 1}. {q.question}
                    </div>
                    {q.type === 'mcq' && typeof q.correctAnswer === 'number' && (
                      <div style={{ color: '#34d399', fontSize: '12px', marginTop: '4px' }}>
                        Correct: {q.options[q.correctAnswer]}
                      </div>
                    )}
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                      <em>{q.explanation}</em>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="card" style={{ padding: '24px', maxWidth: '780px', margin: '0 auto' }}>
      {/* Quiz Header */}
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
              {quiz.difficulty} · {quiz.questionType.replace('_', ' ')}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>{quiz.topic}</span>
          </div>
        </div>

        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
          Question {currentIndex + 1} of {quiz.questions.length}
        </div>
      </div>

      {/* Grounding Notice if applicable */}
      {quiz.groundingNotice && (
        <div style={{ 
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid rgba(245, 158, 11, 0.3)', 
          color: '#fde68a', 
          padding: '8px 12px', 
          borderRadius: '6px', 
          fontSize: '12px', 
          marginBottom: '16px' 
        }}>
          ⚠️ {quiz.groundingNotice}
        </div>
      )}

      {/* Question Prompt */}
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginBottom: '18px', lineHeight: 1.5 }}>
        {currentIndex + 1}. {currentQ.question}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {currentQ.type === 'mcq' && currentQ.options.map((opt, optIdx) => {
          const isSelected = userAnswers[currentIndex] === optIdx;
          const isAnswerSubmitted = submitted[currentIndex];
          const isCorrectChoice = optIdx === currentQ.correctAnswer || (typeof currentQ.correctAnswer === 'string' && opt === currentQ.correctAnswer);

          let bg = '#0f172a';
          let border = '#334155';
          let text = '#e2e8f0';

          if (isAnswerSubmitted) {
            if (isCorrectChoice) {
              bg = 'rgba(16, 185, 129, 0.2)';
              border = '#10b981';
              text = '#6ee7b7';
            } else if (isSelected && !isCorrectChoice) {
              bg = 'rgba(239, 68, 68, 0.2)';
              border = '#ef4444';
              text = '#fca5a5';
            }
          } else if (isSelected) {
            bg = 'rgba(59, 130, 246, 0.2)';
            border = '#3b82f6';
            text = '#93c5fd';
          }

          return (
            <button
              key={optIdx}
              onClick={() => handleSelectOption(currentIndex, optIdx)}
              disabled={isAnswerSubmitted}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: '8px',
                cursor: isAnswerSubmitted ? 'default' : 'pointer',
                textAlign: 'left',
                color: text,
                fontSize: '14px',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%', 
                background: isSelected ? '#3b82f6' : '#1e293b', 
                color: isSelected ? '#fff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0
              }}>
                {String.fromCharCode(65 + optIdx)}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
              {isAnswerSubmitted && isCorrectChoice && <CheckCircle2 size={18} style={{ color: '#10b981' }} />}
              {isAnswerSubmitted && isSelected && !isCorrectChoice && <XCircle size={18} style={{ color: '#ef4444' }} />}
            </button>
          );
        })}

        {currentQ.type === 'true_false' && ['True', 'False'].map((tf) => {
          const isSelected = String(userAnswers[currentIndex]).toLowerCase() === tf.toLowerCase();
          const isAnswerSubmitted = submitted[currentIndex];
          const isCorrect = String(currentQ.correctAnswer).toLowerCase() === tf.toLowerCase();

          let bg = '#0f172a';
          let border = '#334155';
          let text = '#e2e8f0';

          if (isAnswerSubmitted) {
            if (isCorrect) {
              bg = 'rgba(16, 185, 129, 0.2)';
              border = '#10b981';
              text = '#6ee7b7';
            } else if (isSelected && !isCorrect) {
              bg = 'rgba(239, 68, 68, 0.2)';
              border = '#ef4444';
              text = '#fca5a5';
            }
          } else if (isSelected) {
            bg = 'rgba(59, 130, 246, 0.2)';
            border = '#3b82f6';
            text = '#93c5fd';
          }

          return (
            <button
              key={tf}
              onClick={() => handleSelectOption(currentIndex, tf)}
              disabled={isAnswerSubmitted}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: '8px',
                cursor: isAnswerSubmitted ? 'default' : 'pointer',
                textAlign: 'left',
                color: text,
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              <span style={{ flex: 1 }}>{tf}</span>
              {isAnswerSubmitted && isCorrect && <CheckCircle2 size={18} style={{ color: '#10b981' }} />}
              {isAnswerSubmitted && isSelected && !isCorrect && <XCircle size={18} style={{ color: '#ef4444' }} />}
            </button>
          );
        })}

        {currentQ.type === 'short_answer' && (
          <div>
            <textarea
              value={String(userAnswers[currentIndex] || '')}
              onChange={(e) => handleSelectOption(currentIndex, e.target.value)}
              disabled={submitted[currentIndex]}
              placeholder="Write your answer here..."
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '13px'
              }}
            />
          </div>
        )}
      </div>

      {/* Explanation Panel if submitted */}
      {submitted[currentIndex] && (
        <div style={{
          background: isCurrentCorrect() ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${isCurrentCorrect() ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          padding: '14px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '13px', 
            color: isCurrentCorrect() ? '#34d399' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '6px'
          }}>
            <HelpCircle size={16} />
            {isCurrentCorrect() ? 'Correct!' : 'Incorrect'}
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5 }}>
            {currentQ.explanation}
          </div>
          {currentQ.type === 'short_answer' && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#93c5fd' }}>
              <strong>Model Answer:</strong> {String(currentQ.correctAnswer)}
            </div>
          )}
        </div>
      )}

      {/* Bottom Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          style={{
            padding: '8px 14px',
            background: '#1e293b',
            color: currentIndex === 0 ? '#64748b' : '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '6px',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px'
          }}
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          {!submitted[currentIndex] ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={userAnswers[currentIndex] === undefined}
              style={{
                padding: '8px 18px',
                background: userAnswers[currentIndex] === undefined ? '#334155' : '#10b981',
                color: userAnswers[currentIndex] === undefined ? '#94a3b8' : '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: userAnswers[currentIndex] === undefined ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              style={{
                padding: '8px 18px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isLastQuestion ? 'View Results' : 'Next Question'} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
