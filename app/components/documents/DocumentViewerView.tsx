// Offline Study AI - Document Viewer (Phase 3A)
import React, { useState, useMemo } from 'react';
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
  AlertCircle 
} from 'lucide-react';
import { DocumentRecord } from '../../../documents/types';

interface DocumentViewerViewProps {
  document: DocumentRecord;
  onBack: () => void;
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

export const DocumentViewerView: React.FC<DocumentViewerViewProps> = ({ document: doc, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const textContent = doc.extracted_text || '';

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
        </div>
      </div>

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
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
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
    </div>
  );
};
