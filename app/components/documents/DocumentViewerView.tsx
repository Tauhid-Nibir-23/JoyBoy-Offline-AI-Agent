// Offline Study AI - Document Viewer & Chunk Inspector (Phase 3A & 3B)
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Search, 
  X, 
  FileText, 
  Hash, 
  Calendar, 
  HardDrive, 
  AlertCircle,
  RefreshCw,
  Layers,
  BookOpen,
  ChevronRight,
  Sparkles,
  ChevronDown,
  Lightbulb,
  Award
} from 'lucide-react';
import { DocumentRecord } from '../../../documents/types';
import { DocumentChunk } from '../../../documents/chunking/types';
import { chunkService } from '../../../documents/chunking/chunkService';
import { StudyActionType } from '../../../study/types';

interface DocumentViewerViewProps {
  document: DocumentRecord;
  onBack: () => void;
  onStudyAction?: (docId: string, action: StudyActionType) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export const DocumentViewerView: React.FC<DocumentViewerViewProps> = ({ document: doc, onBack, onStudyAction }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'chunks'>('text');
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedChunkText, setCopiedChunkText] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showStudyMenu, setShowStudyMenu] = useState(false);

  const textContent = doc.extracted_text || '';

  const loadChunks = async () => {
    try {
      const list = await chunkService.getChunksForDocument(doc.id);
      setChunks(list);
      if (list.length > 0 && !selectedChunkId) {
        setSelectedChunkId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load chunks:', err);
    }
  };

  useEffect(() => {
    loadChunks();
  }, [doc.id]);

  const handleReprocess = async () => {
    setIsReprocessing(true);
    setActionMessage(null);
    try {
      const updatedChunks = await chunkService.reprocessDocument(doc.id);
      setChunks(updatedChunks);
      if (updatedChunks.length > 0) {
        setSelectedChunkId(updatedChunks[0].id);
      }
      setActionMessage(`Document successfully reprocessed into ${updatedChunks.length} chunks.`);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage(`Reprocessing failed: ${err?.message || String(err)}`);
      setTimeout(() => setActionMessage(null), 5000);
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyChunkText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedChunkText(true);
      setTimeout(() => setCopiedChunkText(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyHash = async () => {
    try {
      await navigator.clipboard.writeText(doc.file_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Safe highlighted text rendering without dangerouslySetInnerHTML
  const { highlightedElements, matchCount } = useMemo(() => {
    if (!textContent || !searchQuery.trim()) {
      return {
        highlightedElements: <span>{textContent}</span>,
        matchCount: 0
      };
    }

    const query = searchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = textContent.split(regex);
    let count = 0;

    const elements = parts.map((part, index) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        count++;
        return (
          <mark
            key={index}
            style={{
              backgroundColor: '#f59e0b',
              color: '#000000',
              padding: '1px 3px',
              borderRadius: '2px',
              fontWeight: 600
            }}
          >
            {part}
          </mark>
        );
      }
      return <span key={index}>{part}</span>;
    });

    return {
      highlightedElements: <>{elements}</>,
      matchCount: count
    };
  }, [textContent, searchQuery]);

  const selectedChunk = chunks.find(c => c.id === selectedChunkId) || chunks[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Top Header / Back Bar */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '12px',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '16px'
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            padding: '7px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          <ArrowLeft size={16} />
          Back to Documents
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Reprocess Button */}
          <button
            onClick={handleReprocess}
            disabled={isReprocessing || !textContent}
            title="Reprocess document into fresh clean chunks"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #d97706',
              padding: '7px 14px',
              borderRadius: '6px',
              cursor: isReprocessing || !textContent ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              opacity: isReprocessing || !textContent ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} className={isReprocessing ? 'spin-animation' : ''} style={{ color: '#f59e0b' }} />
            <span>{isReprocessing ? 'Reprocessing...' : 'Reprocess Chunks'}</span>
          </button>

          {/* Copy Text Button */}
          <button
            onClick={handleCopyText}
            disabled={!textContent}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: copied ? '#065f46' : '#1e293b',
              color: copied ? '#34d399' : '#f8fafc',
              border: `1px solid ${copied ? '#059669' : '#334155'}`,
              padding: '7px 14px',
              borderRadius: '6px',
              cursor: textContent ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: 500,
              opacity: textContent ? 1 : 0.5
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied Text' : 'Copy Extracted Text'}
          </button>

          {/* Study with AI Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowStudyMenu(prev => !prev)}
              disabled={!textContent}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f59e0b',
                color: '#0f172a',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '6px',
                cursor: textContent ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: 700,
                opacity: textContent ? 1 : 0.5
              }}
            >
              <Sparkles size={15} />
              <span>Study with AI</span>
              <ChevronDown size={14} />
            </button>

            {showStudyMenu && (
              <div 
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                  zIndex: 50,
                  width: '210px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '6px' }}>
                  <button
                    onClick={() => {
                      setShowStudyMenu(false);
                      onStudyAction?.(doc.id, 'explain');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '5px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Lightbulb size={15} style={{ color: '#ec4899' }} /> Explain this document
                  </button>

                  <button
                    onClick={() => {
                      setShowStudyMenu(false);
                      onStudyAction?.(doc.id, 'summarize');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '5px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <FileText size={15} style={{ color: '#10b981' }} /> Summarize this document
                  </button>

                  <button
                    onClick={() => {
                      setShowStudyMenu(false);
                      onStudyAction?.(doc.id, 'notes');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '5px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <BookOpen size={15} style={{ color: '#a855f7' }} /> Make notes
                  </button>

                  <button
                    onClick={() => {
                      setShowStudyMenu(false);
                      onStudyAction?.(doc.id, 'quiz');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '5px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Award size={15} style={{ color: '#f59e0b' }} /> Generate quiz / MCQ
                  </button>

                  <button
                    onClick={() => {
                      setShowStudyMenu(false);
                      onStudyAction?.(doc.id, 'flashcards');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '5px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Layers size={15} style={{ color: '#3b82f6' }} /> Generate flashcards
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#6ee7b7'
          }}
        >
          {actionMessage}
        </div>
      )}

      {/* Document Metadata Banner */}
      <div 
        style={{ 
          background: '#0f172a', 
          border: '1px solid #1e293b', 
          borderRadius: '8px', 
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '8px', 
                background: '#1e293b', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#f59e0b'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                {doc.filename}
              </h2>
              {doc.original_path && (
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', wordBreak: 'break-all' }}>
                  {doc.original_path}
                </div>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              background: doc.extraction_status === 'Ready' ? 'rgba(16, 185, 129, 0.15)' :
                          doc.extraction_status === 'Processing' ? 'rgba(245, 158, 11, 0.15)' :
                          doc.extraction_status === 'Failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              color: doc.extraction_status === 'Ready' ? '#6ee7b7' :
                     doc.extraction_status === 'Processing' ? '#fde68a' :
                     doc.extraction_status === 'Failed' ? '#fca5a5' : '#93c5fd',
              border: `1px solid ${
                doc.extraction_status === 'Ready' ? 'rgba(16, 185, 129, 0.3)' :
                doc.extraction_status === 'Processing' ? 'rgba(245, 158, 11, 0.3)' :
                doc.extraction_status === 'Failed' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'
              }`
            }}
          >
            <span 
              className={`status-dot ${
                doc.extraction_status === 'Ready' ? 'dot-green' :
                doc.extraction_status === 'Processing' ? 'dot-amber' :
                doc.extraction_status === 'Failed' ? 'dot-red' : 'dot-amber'
              }`} 
            />
            {doc.extraction_status}
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
            gap: '12px',
            background: '#070b14',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#cbd5e1'
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Format:</span>{' '}
            <strong style={{ color: '#e2e8f0', textTransform: 'uppercase' }}>{doc.file_type}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>File Size:</span>{' '}
            <strong style={{ color: '#e2e8f0' }}>{formatBytes(doc.file_size)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Extracted Chars:</span>{' '}
            <strong style={{ color: '#f59e0b' }}>{doc.character_count.toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Knowledge Chunks:</span>{' '}
            <strong style={{ color: '#6ee7b7' }}>{chunks.length} chunks</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Imported:</span>{' '}
            <span>{formatDate(doc.imported_at)}</span>
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#64748b' }}>SHA-256:</span>
            <code style={{ fontSize: '11px', color: '#94a3b8', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>
              {doc.file_hash}
            </code>
            <button
              onClick={handleCopyHash}
              title="Copy SHA-256 Hash"
              style={{
                background: 'transparent',
                border: 'none',
                color: copiedHash ? '#34d399' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {copiedHash ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Error message if extraction failed */}
        {doc.extraction_status === 'Failed' && doc.error_message && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 14px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '13px'
            }}
          >
            <AlertCircle size={16} />
            <span>Extraction error: {doc.error_message}</span>
          </div>
        )}
      </div>

      {/* View Switcher: Extracted Text vs Knowledge Chunks */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('text')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'text' ? '#1e293b' : 'transparent',
            color: activeTab === 'text' ? '#f59e0b' : '#94a3b8',
            border: activeTab === 'text' ? '1px solid #d97706' : '1px solid transparent'
          }}
        >
          <BookOpen size={15} />
          Extracted Text
        </button>

        <button
          onClick={() => setActiveTab('chunks')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'chunks' ? '#1e293b' : 'transparent',
            color: activeTab === 'chunks' ? '#f59e0b' : '#94a3b8',
            border: activeTab === 'chunks' ? '1px solid #d97706' : '1px solid transparent'
          }}
        >
          <Layers size={15} />
          Knowledge Chunks ({chunks.length})
        </button>
      </div>

      {/* Tab 1: Extracted Text */}
      {activeTab === 'text' && (
        <>
          {/* In-Document Search Toolbar */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: '12px',
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '8px 14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <Search size={16} style={{ color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search within extracted text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '13px',
                  width: '100%',
                  outline: 'none'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {searchQuery.trim() && (
              <div style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {matchCount} {matchCount === 1 ? 'match' : 'matches'} found
              </div>
            )}
          </div>

          {/* Extracted Text Viewing Area */}
          <div 
            style={{ 
              flex: 1, 
              background: '#070b14', 
              border: '1px solid #1e293b', 
              borderRadius: '8px', 
              padding: '20px',
              overflowY: 'auto',
              minHeight: '350px'
            }}
          >
            {textContent ? (
              <pre 
                style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#e2e8f0',
                  margin: 0
                }}
              >
                {highlightedElements}
              </pre>
            ) : (
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100%',
                  color: '#64748b',
                  textAlign: 'center',
                  padding: '40px'
                }}
              >
                <FileText size={40} style={{ marginBottom: '12px', color: '#334155' }} />
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#94a3b8' }}>
                  {doc.extraction_status === 'Failed' 
                    ? 'Text extraction failed for this document.' 
                    : 'No readable text content found in this document.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab 2: Knowledge Chunks Inspection UI */}
      {activeTab === 'chunks' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: '16px', flex: 1, minHeight: '400px' }}>
          {/* Chunks List Column */}
          <div 
            style={{ 
              background: '#0f172a', 
              border: '1px solid #1e293b', 
              borderRadius: '8px', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column',
              maxHeight: '550px'
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', background: '#0a0f1d' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                Document Chunks ({chunks.length})
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Normalized segments ready for local RAG
              </div>
            </div>

            {chunks.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No chunks generated yet. Click "Reprocess Chunks" above to generate chunks.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {chunks.map((chunk) => {
                  const isSelected = selectedChunk?.id === chunk.id;
                  return (
                    <div
                      key={chunk.id}
                      onClick={() => setSelectedChunkId(chunk.id)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #1e293b',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                        borderLeft: isSelected ? '3px solid #f59e0b' : '3px solid transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? '#f59e0b' : '#f8fafc' }}>
                          Chunk #{chunk.chunkIndex + 1}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          ~{chunk.tokenEstimate} tokens
                        </span>
                      </div>

                      {chunk.heading && (
                        <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 500, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          § {chunk.heading}
                        </div>
                      )}

                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', lineHeight: '1.4' }}>
                        {chunk.text.substring(0, 90)}...
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '10px', color: '#94a3b8' }}>
                        <span>{chunk.characterCount} chars</span>
                        {chunk.pageNumber && <span>Page {chunk.pageNumber}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chunk Inspector Column */}
          <div 
            style={{ 
              background: '#070b14', 
              border: '1px solid #1e293b', 
              borderRadius: '8px', 
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '550px'
            }}
          >
            {selectedChunk ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                      Chunk #{selectedChunk.chunkIndex + 1} Details
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Offset: {selectedChunk.startOffset}–{selectedChunk.endOffset} · {selectedChunk.characterCount} chars · ~{selectedChunk.tokenEstimate} estimated tokens
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyChunkText(selectedChunk.text)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: copiedChunkText ? '#065f46' : '#1e293b',
                      color: copiedChunkText ? '#34d399' : '#cbd5e1',
                      border: '1px solid #334155',
                      padding: '5px 10px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 500
                    }}
                  >
                    {copiedChunkText ? <Check size={13} /> : <Copy size={13} />}
                    {copiedChunkText ? 'Copied' : 'Copy Chunk'}
                  </button>
                </div>

                {selectedChunk.heading && (
                  <div style={{ background: '#0f172a', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', color: '#f59e0b' }}>
                    <strong>Heading:</strong> {selectedChunk.heading}
                  </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <pre 
                    style={{ 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '12.5px',
                      lineHeight: '1.6',
                      color: '#e2e8f0',
                      margin: 0
                    }}
                  >
                    {selectedChunk.text}
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '13px' }}>
                Select a chunk to inspect its full text and metadata
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
