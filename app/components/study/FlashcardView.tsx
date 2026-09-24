// Offline Study AI - Interactive Flashcards View (Phase 5)
import React, { useState } from 'react';
import { 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  RotateCcw, 
  MessageSquare, 
  HelpCircle,
  Eye,
  Layers
} from 'lucide-react';
import { FlashcardDeck, FlashcardItem } from '../../../study/types';

interface FlashcardViewProps {
  deck: FlashcardDeck;
  onOpenInChat: (card: FlashcardItem, topic: string) => void;
  onRetry: () => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ deck, onOpenInChat, onRetry }) => {
  const [cards, setCards] = useState<FlashcardItem[]>(deck.cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0); // loop around
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(cards.length - 1);
    }
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
  };

  const handleReset = () => {
    setIsFlipped(false);
    setCards(deck.cards);
    setCurrentIndex(0);
  };

  if (!currentCard) return null;

  return (
    <div className="card" style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      {/* Deck Header */}
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
            Flashcards
          </span>
          <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '14px' }}>{deck.topic}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '13px', fontWeight: 600 }}>
          <Layers size={15} /> Card {currentIndex + 1} of {cards.length}
        </div>
      </div>

      {/* Grounding Notice if applicable */}
      {deck.groundingNotice && (
        <div style={{ 
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid rgba(245, 158, 11, 0.3)', 
          color: '#fde68a', 
          padding: '8px 12px', 
          borderRadius: '6px', 
          fontSize: '12px', 
          marginBottom: '16px' 
        }}>
          ⚠️ {deck.groundingNotice}
        </div>
      )}

      {/* Main Flashcard Component */}
      <div 
        onClick={handleFlip}
        style={{
          minHeight: '260px',
          background: isFlipped ? '#1e293b' : '#0f172a',
          border: `2px solid ${isFlipped ? '#3b82f6' : '#334155'}`,
          borderRadius: '12px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          transition: 'all 0.2s ease',
          marginBottom: '20px'
        }}
      >
        <div style={{ 
          fontSize: '11px', 
          fontWeight: 700, 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px',
          color: isFlipped ? '#93c5fd' : '#94a3b8',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {isFlipped ? <Eye size={14} /> : <HelpCircle size={14} />}
          {isFlipped ? 'Answer / Explanation (Click to flip)' : 'Question / Concept (Click to flip)'}
        </div>

        <div style={{ 
          fontSize: isFlipped ? '16px' : '20px', 
          fontWeight: isFlipped ? 400 : 700, 
          color: '#f8fafc',
          lineHeight: 1.6,
          maxWidth: '560px'
        }}>
          {isFlipped ? currentCard.back : currentCard.front}
        </div>

        <div style={{ marginTop: '20px', fontSize: '11px', color: '#64748b' }}>
          💡 Click card or press Flip to reveal answer
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrev}
            style={{
              padding: '8px 14px',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px'
            }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <button
            onClick={handleFlip}
            style={{
              padding: '8px 16px',
              background: '#334155',
              color: '#ffedd5',
              border: '1px solid #475569',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <RotateCw size={15} /> {isFlipped ? 'Show Front' : 'Reveal Back'}
          </button>

          <button
            onClick={handleNext}
            style={{
              padding: '8px 14px',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px'
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleShuffle}
            title="Shuffle Cards"
            style={{
              padding: '8px 12px',
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            <Shuffle size={14} /> Shuffle
          </button>

          <button
            onClick={() => onOpenInChat(currentCard, deck.topic)}
            style={{
              padding: '8px 14px',
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
            <MessageSquare size={14} /> Explain in Chat
          </button>
        </div>
      </div>
    </div>
  );
};
