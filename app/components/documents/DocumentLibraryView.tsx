// Offline Study AI - Document Library View (Phase 3A)
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  FileCode,
  FileType,
  X
} from 'lucide-react';
import { DocumentRecord, ImportResult } from '../../../documents/types';
import { documentService } from '../../../documents/documentService';
import { DocumentViewerView } from './DocumentViewerView';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function getFileIcon(fileType: string) {
  const t = fileType.toLowerCase();
  if (t === 'pdf') {
    return <FileType size={18} style={{ color: '#ef4444' }} />;
  }
  if (t === 'docx') {
    return <FileText size={18} style={{ color: '#3b82f6' }} />;
  }
  if (['py', 'js', 'ts', 'tsx', 'java', 'cpp', 'c', 'html', 'css', 'json'].includes(t)) {
    return <FileCode size={18} style={{ color: '#f59e0b' }} />;
  }
  return <FileText size={18} style={{ color: '#10b981' }} />;
}

export const DocumentLibraryView: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    try {
      const list = await documentService.listDocuments();
      setDocuments(list);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const showToast = (type: 'success' | 'warning' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsImporting(true);
    const fileArray = Array.from(files);
    let successCount = 0;
    let duplicateCount = 0;
    let failureCount = 0;
    const duplicateNames: string[] = [];

    for (const file of fileArray) {
      try {
        const res: ImportResult = await documentService.importFile(file);
        if (res.success) {
          successCount++;
        } else if (res.isDuplicate) {
          duplicateCount++;
          duplicateNames.push(file.name);
        } else {
          failureCount++;
        }
      } catch (err) {
        failureCount++;
      }
    }

    setIsImporting(false);
    await loadDocuments();

    if (duplicateCount > 0 && successCount === 0) {
      showToast('warning', `Already imported: ${duplicateNames.slice(0, 2).join(', ')}${duplicateNames.length > 2 ? ` (+${duplicateNames.length - 2} more)` : ''}. Duplicate records were not created.`);
    } else if (duplicateCount > 0 && successCount > 0) {
      showToast('warning', `Imported ${successCount} document(s). Skipped ${duplicateCount} duplicate(s).`);
    } else if (successCount > 0) {
      showToast('success', `Successfully imported ${successCount} document(s).`);
    } else if (failureCount > 0) {
      showToast('error', 'Failed to import selected file(s). Please verify file formats.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      const ok = await documentService.deleteDocument(id);
      if (ok) {
        if (selectedDocId === id) {
          setSelectedDocId(null);
        }
        await loadDocuments();
        showToast('success', `Deleted "${name}".`);
      } else {
        showToast('error', `Failed to delete "${name}".`);
      }
    }
  };

  const filteredDocs = documents.filter(d => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    return d.filename.toLowerCase().includes(q) || d.file_type.toLowerCase().includes(q);
  });

  const selectedDocument = selectedDocId ? documents.find(d => d.id === selectedDocId) : null;

  if (selectedDocument) {
    return (
      <DocumentViewerView 
        document={selectedDocument} 
        onBack={() => {
          setSelectedDocId(null);
          loadDocuments();
        }} 
      />
    );
  }

  // Summary counts
  const readyCount = documents.filter(d => d.extraction_status === 'Ready').length;
  const processingCount = documents.filter(d => d.extraction_status === 'Processing').length;
  const failedCount = documents.filter(d => d.extraction_status === 'Failed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* Top Banner & Stats */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '16px' 
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '0.2px' }}>
            Document Library
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
            Local offline study documents, textbooks, lecture slides, and notes.
          </p>
        </div>

        {/* Action Buttons & Hidden Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf,.docx,.txt,.md,.py,.js,.ts,.tsx,.java,.cpp,.c,.html,.css,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="wooden-action-btn"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              width: 'auto',
              minWidth: '150px'
            }}
          >
            {isImporting ? <RefreshCw size={15} className="spin-animation" /> : <Upload size={15} />}
            <span>{isImporting ? 'Extracting...' : 'Import Documents'}</span>
          </button>
        </div>
      </div>

      {/* Toast Alert Banner */}
      {toast && (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' :
                        toast.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: toast.type === 'success' ? '#6ee7b7' :
                   toast.type === 'warning' ? '#fde68a' : '#fca5a5',
            border: `1px solid ${
              toast.type === 'success' ? 'rgba(16, 185, 129, 0.3)' :
              toast.type === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'
            }`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toast.message}</span>
          </div>
          <button 
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#f59e0b' : 'rgba(217, 119, 6, 0.3)'}`,
          backgroundColor: isDragging ? 'rgba(245, 158, 11, 0.08)' : 'rgba(15, 23, 42, 0.4)',
          borderRadius: '12px',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          textAlign: 'center'
        }}
      >
        <Upload size={28} style={{ color: isDragging ? '#f59e0b' : '#d97706', marginBottom: '8px' }} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
          Drag and drop study files here, or click to browse
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
          Supported: PDF, DOCX, TXT, Markdown (.md), Code (.py, .js, .ts, .tsx, .java, .cpp, .c, .html, .css, .json)
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {/* Search input */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '7px 12px',
            flex: '1',
            minWidth: '220px',
            maxWidth: '360px'
          }}
        >
          <Search size={15} style={{ color: '#64748b' }} />
          <input
            type="text"
            placeholder="Filter by name or extension..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '13px',
              width: '100%',
              outline: 'none'
            }}
          />
          {filterQuery && (
            <button 
              onClick={() => setFilterQuery('')}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Stats Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8' }}>
          <span style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '6px' }}>
            Total: <strong style={{ color: '#f8fafc' }}>{documents.length}</strong>
          </span>
          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#6ee7b7', padding: '4px 8px', borderRadius: '6px' }}>
            Ready: <strong>{readyCount}</strong>
          </span>
          {processingCount > 0 && (
            <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fde68a', padding: '4px 8px', borderRadius: '6px' }}>
              Processing: <strong>{processingCount}</strong>
            </span>
          )}
          {failedCount > 0 && (
            <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '4px 8px', borderRadius: '6px' }}>
              Failed: <strong>{failedCount}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Documents Table */}
      <div 
        style={{ 
          flex: 1, 
          background: '#0f172a', 
          border: '1px solid #1e293b', 
          borderRadius: '10px', 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {filteredDocs.length === 0 ? (
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '60px 20px', 
              color: '#64748b' 
            }}
          >
            <FileText size={48} style={{ color: '#334155', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8' }}>
              {documents.length === 0 ? 'No documents imported yet' : 'No documents match filter'}
            </h3>
            <p style={{ fontSize: '13px', marginTop: '6px', maxWidth: '360px', textAlign: 'center' }}>
              {documents.length === 0 
                ? 'Import textbooks, PDF papers, notes, or source code files to build your local knowledge base.'
                : 'Try adjusting your search query above.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0a0f1d', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Size</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Imported</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Extracted</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const isReady = doc.extraction_status === 'Ready';
                  const isProcessing = doc.extraction_status === 'Processing';
                  const isFailed = doc.extraction_status === 'Failed';

                  return (
                    <tr 
                      key={doc.id}
                      style={{ 
                        borderBottom: '1px solid #1e293b',
                        transition: 'background 0.15s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#131d36')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => setSelectedDocId(doc.id)}
                    >
                      <td style={{ padding: '12px 16px', color: '#f8fafc', fontWeight: 500, maxWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {getFileIcon(doc.file_type)}
                          <span 
                            style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }} 
                            title={doc.filename}
                          >
                            {doc.filename}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span 
                          style={{ 
                            background: '#1e293b', 
                            padding: '3px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            color: '#cbd5e1'
                          }}
                        >
                          {doc.file_type}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', color: '#94a3b8' }}>
                        {formatBytes(doc.file_size)}
                      </td>

                      <td style={{ padding: '12px 14px', color: '#94a3b8' }}>
                        {formatDate(doc.imported_at)}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: isReady ? 'rgba(16, 185, 129, 0.15)' :
                                        isProcessing ? 'rgba(245, 158, 11, 0.15)' :
                                        isFailed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: isReady ? '#6ee7b7' :
                                   isProcessing ? '#fde68a' :
                                   isFailed ? '#fca5a5' : '#93c5fd'
                          }}
                        >
                          <span 
                            className={`status-dot ${
                              isReady ? 'dot-green' :
                              isProcessing ? 'dot-amber' :
                              isFailed ? 'dot-red' : 'dot-amber'
                            }`}
                          />
                          {doc.extraction_status}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', color: isReady ? '#e2e8f0' : '#64748b' }}>
                        {isReady ? `${doc.character_count.toLocaleString()} chars` : '—'}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedDocId(doc.id)}
                            title="View Document"
                            style={{
                              background: '#1e293b',
                              border: '1px solid #334155',
                              color: '#f8fafc',
                              padding: '5px 9px',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <Eye size={14} />
                            View
                          </button>

                          <button
                            onClick={() => handleDelete(doc.id, doc.filename)}
                            title="Delete Document"
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              padding: '5px 9px',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              fontSize: '12px'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
