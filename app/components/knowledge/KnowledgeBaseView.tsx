// Offline Study AI - Knowledge Base & Local RAG View (Phase 4 Section 5)
import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  BookOpen, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Layers, 
  FileText, 
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  FileCode,
  FileType,
  Info
} from 'lucide-react';
import { StudyActionType } from '../../../study/types';
import { ragService } from '../../../rag';
import { RAGIndexingStats, RAGSearchResult } from '../../../rag/types';
import { chatService } from '../../../ai/chatService';
import { documentService } from '../../../documents/documentService';
import { 
  getAllDocuments, 
  DBDocument, 
  getChunkCountByDocumentId, 
  getChunksByDocumentId, 
  DBDocumentChunk 
} from '../../../database/db';
import { globalStatus } from '../../../core/status';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
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

export interface KnowledgeBaseViewProps {
  onStudyAction?: (docId: string, action: StudyActionType) => void;
}

export function KnowledgeBaseView({ onStudyAction }: KnowledgeBaseViewProps = {}) {
  const [stats, setStats] = useState<RAGIndexingStats>({
    totalDocuments: 0,
    indexedDocuments: 0,
    indexingDocuments: 0,
    failedDocuments: 0,
    totalChunks: 0,
    embeddedChunks: 0
  });
  const [documents, setDocuments] = useState<DBDocument[]>([]);
  const [searchDocQuery, setSearchDocQuery] = useState<string>('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocChunks, setSelectedDocChunks] = useState<DBDocumentChunk[]>([]);

  const [useStudyMaterials, setUseStudyMaterials] = useState<boolean>(true);
  const [testQuery, setTestQuery] = useState<string>('What is process scheduling?');
  const [searchResults, setSearchResults] = useState<RAGSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isIndexingAll, setIsIndexingAll] = useState<boolean>(false);
  const [indexingDocId, setIndexingDocId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  };

  const refreshData = () => {
    try {
      const currentStats = ragService.getIndexingStats();
      setStats(currentStats);
      const docs = getAllDocuments();
      setDocuments(docs);
      setUseStudyMaterials(chatService.isStudyMaterialsEnabled());

      if (selectedDocId) {
        setSelectedDocChunks(getChunksByDocumentId(selectedDocId));
      }
    } catch (err) {
      console.error('Failed to load knowledge base data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [selectedDocId]);

  const handleToggleStudyMaterials = () => {
    const next = !useStudyMaterials;
    setUseStudyMaterials(next);
    chatService.setStudyMaterialsEnabled(next);
  };

  const handleSearchTest = async () => {
    if (!testQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await ragService.search(testQuery.trim(), { topK: 4 });
      setSearchResults(results);
    } catch (err) {
      console.error('Search test failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleIndexDocument = async (docId: string) => {
    setIndexingDocId(docId);
    globalStatus.setRAGStatus('Indexing');
    try {
      await ragService.indexDocument(docId);
      refreshData();
      globalStatus.setRAGStatus('Ready');
      showToast('success', 'Document indexed successfully.');
    } catch (err: any) {
      console.error('Index document failed:', err);
      globalStatus.setRAGStatus('Error', err.message);
      showToast('error', 'Indexing failed: ' + err.message);
    } finally {
      setIndexingDocId(null);
    }
  };

  const handleIndexAll = async () => {
    setIsIndexingAll(true);
    globalStatus.setRAGStatus('Indexing');
    try {
      await ragService.indexAllPendingDocuments();
      refreshData();
      globalStatus.setRAGStatus('Ready');
      showToast('success', 'Indexed all pending documents.');
    } catch (err: any) {
      console.error('Index all failed:', err);
      globalStatus.setRAGStatus('Error', err.message);
      showToast('error', 'Index all failed: ' + err.message);
    } finally {
      setIsIndexingAll(false);
    }
  };

  const handleDeleteDocument = async (doc: DBDocument) => {
    if (window.confirm(`Are you sure you want to delete "${doc.filename}" and all its indexed chunks?`)) {
      try {
        const ok = await documentService.deleteDocument(doc.id);
        if (ok) {
          if (selectedDocId === doc.id) {
            setSelectedDocId(null);
            setSelectedDocChunks([]);
          }
          refreshData();
          showToast('info', `Deleted "${doc.filename}".`);
        } else {
          showToast('error', `Could not delete "${doc.filename}".`);
        }
      } catch (err: any) {
        showToast('error', 'Delete error: ' + err.message);
      }
    }
  };

  const handleSelectDoc = (docId: string) => {
    if (selectedDocId === docId) {
      setSelectedDocId(null);
      setSelectedDocChunks([]);
    } else {
      setSelectedDocId(docId);
      setSelectedDocChunks(getChunksByDocumentId(docId));
    }
  };

  const filteredDocs = documents.filter((d) => {
    const q = searchDocQuery.toLowerCase().trim();
    if (!q) return true;
    return d.filename.toLowerCase().includes(q) || d.file_type.toLowerCase().includes(q);
  });

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto', paddingRight: '4px', paddingBottom: '30px' }}>
      
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(217, 119, 6, 0.35)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: 'rgba(217, 119, 6, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b'
          }}>
            <Database size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffedd5', margin: 0 }}>
              Local Knowledge Base & RAG Index
            </h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Semantic vector indexing and cosine retrieval for study materials · 100% Offline
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Use Study Materials Toggle */}
          <button
            onClick={handleToggleStudyMaterials}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: useStudyMaterials ? 'rgba(217, 119, 6, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              border: useStudyMaterials ? '1px solid #f59e0b' : '1px solid #475569',
              color: useStudyMaterials ? '#ffedd5' : '#94a3b8'
            }}
          >
            <BookOpen size={15} style={{ color: useStudyMaterials ? '#f59e0b' : '#64748b' }} />
            <span>Use Study Materials</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: useStudyMaterials ? '#d97706' : '#334155',
              color: useStudyMaterials ? '#1c1917' : '#94a3b8'
            }}>
              {useStudyMaterials ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Index All Button */}
          <button
            onClick={handleIndexAll}
            disabled={isIndexingAll || stats.totalDocuments === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isIndexingAll ? 'not-allowed' : 'pointer',
              backgroundColor: '#334155',
              border: '1px solid #475569',
              color: '#f8fafc',
              opacity: stats.totalDocuments === 0 ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} className={isIndexingAll ? 'animate-spin' : ''} />
            <span>{isIndexingAll ? 'Indexing...' : 'Index Pending'}</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          backgroundColor: toastMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : toastMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${toastMsg.type === 'success' ? '#10b981' : toastMsg.type === 'error' ? '#ef4444' : '#3b82f6'}`,
          color: toastMsg.type === 'success' ? '#6ee7b7' : toastMsg.type === 'error' ? '#fca5a5' : '#93c5fd'
        }}>
          {toastMsg.text}
        </div>
      )}

      {/* 4 Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px'
      }}>
        {/* Total Documents */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8'
          }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
              {stats.totalDocuments}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Documents</div>
          </div>
        </div>

        {/* Indexed Documents */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981'
          }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>
              {stats.indexedDocuments}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Indexed Documents</div>
          </div>
        </div>

        {/* Total Vector Chunks */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b'
          }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>
              {stats.embeddedChunks} <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>/ {stats.totalChunks}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Embedded Chunks</div>
          </div>
        </div>

        {/* Index Failed */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: stats.failedDocuments > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: stats.failedDocuments > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: stats.failedDocuments > 0 ? '#ef4444' : '#64748b'
          }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: stats.failedDocuments > 0 ? '#f87171' : '#f8fafc' }}>
              {stats.failedDocuments}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Failed Indexes</div>
          </div>
        </div>
      </div>

      {/* Interactive Retrieval Test Bar */}
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Sparkles size={16} style={{ color: '#f59e0b' }} />
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Interactive Vector Retrieval Tester
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            (Verify how queries match local document chunks before chat injection)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(8, 12, 22, 0.9)',
            border: '1px solid rgba(217, 119, 6, 0.3)',
            borderRadius: '8px',
            padding: '8px 14px'
          }}>
            <Search size={16} style={{ color: '#94a3b8' }} />
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchTest()}
              placeholder="Enter study query to test retrieval (e.g., Round Robin scheduling)..."
              style={{
                background: 'none',
                border: 'none',
                color: '#f8fafc',
                fontSize: '13px',
                width: '100%',
                outline: 'none'
              }}
            />
          </div>
          <button
            onClick={handleSearchTest}
            disabled={isSearching || !testQuery.trim()}
            style={{
              padding: '8px 18px',
              backgroundColor: '#d97706',
              color: '#1c1917',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isSearching ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isSearching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            <span>Search Chunks</span>
          </button>
        </div>

        {/* Retrieval Results */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24' }}>
              Top Matching Chunks ({searchResults.length}):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {searchResults.map((res, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(10, 15, 29, 0.95)',
                    border: '1px solid rgba(217, 119, 6, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
                      📄 {res.chunk.filename}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {Math.round(res.similarity * 100)}% match
                    </span>
                  </div>
                  {res.chunk.heading && (
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Section: {res.chunk.heading}
                    </div>
                  )}
                  <div style={{
                    fontSize: '12px',
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                    maxHeight: '100px',
                    overflowY: 'auto',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}>
                    {res.chunk.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Documents Status Table with Search Filter */}
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Knowledge Base Documents
            </h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Select a row to inspect its generated chunks · Re-index or remove files
            </span>
          </div>

          {/* Search documents filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#090d16',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '5px 10px',
            width: '240px'
          }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Filter documents..."
              value={searchDocQuery}
              onChange={(e) => setSearchDocQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#f8fafc',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '13px' }}>
            {documents.length === 0 
              ? 'No documents imported yet. Go to the Documents tab to import PDF, DOCX, TXT, or code files.'
              : 'No documents match your search query.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)', color: '#94a3b8', fontSize: '12px' }}>
                  <th style={{ padding: '8px 12px' }}>Document</th>
                  <th style={{ padding: '8px 12px' }}>Type</th>
                  <th style={{ padding: '8px 12px' }}>Characters</th>
                  <th style={{ padding: '8px 12px' }}>Chunks</th>
                  <th style={{ padding: '8px 12px' }}>Indexed Date</th>
                  <th style={{ padding: '8px 12px' }}>Extraction</th>
                  <th style={{ padding: '8px 12px' }}>Index Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const isThisIndexing = indexingDocId === doc.id;
                  const isIndexed = doc.indexing_status === 'Indexed';
                  const isFailed = doc.indexing_status === 'Index Failed' || doc.extraction_status === 'Failed';
                  const isSelected = selectedDocId === doc.id;
                  const chunkCount = getChunkCountByDocumentId(doc.id);

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => handleSelectDoc(doc.id)}
                      style={{
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#f8fafc',
                        backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: isSelected ? '#fbbf24' : '#f8fafc' }}>{doc.filename}</span>
                          {doc.error_message && (
                            <span title={doc.error_message} style={{ color: '#ef4444', display: 'inline-flex' }}>
                              <AlertCircle size={14} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          textTransform: 'uppercase',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#38bdf8'
                        }}>
                          {doc.file_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                        {doc.character_count.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#fbbf24', fontWeight: 600 }}>
                        {chunkCount}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '12px' }}>
                        {formatDate(doc.indexed_at)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: doc.extraction_status === 'Ready' ? '#10b981' : (doc.extraction_status === 'Failed' ? '#ef4444' : '#f59e0b')
                        }}>
                          {doc.extraction_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: isIndexed ? '#10b981' : (isFailed ? '#ef4444' : '#f59e0b')
                        }}>
                          {isIndexed && <CheckCircle size={12} />}
                          {isThisIndexing && <RefreshCw size={12} className="animate-spin" />}
                          {isFailed && <AlertCircle size={12} />}
                          {isThisIndexing ? 'Indexing...' : (doc.indexing_status || 'Ready')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => onStudyAction?.(doc.id, 'explain')}
                            title="Study this document in Study Mode"
                            style={{
                              padding: '4px 9px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              color: '#fde68a',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Sparkles size={12} style={{ color: '#f59e0b' }} />
                            Study
                          </button>

                          <button
                            onClick={() => handleIndexDocument(doc.id)}
                            disabled={isThisIndexing || doc.extraction_status !== 'Ready'}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              color: '#cbd5e1',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: doc.extraction_status === 'Ready' ? 'pointer' : 'not-allowed',
                              opacity: doc.extraction_status === 'Ready' ? 1 : 0.5
                            }}
                          >
                            {isIndexed ? 'Re-index' : 'Index'}
                          </button>

                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            title="Delete document"
                            style={{
                              padding: '4px 8px',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#fca5a5',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
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

      {/* Selected Document Chunks Inspector */}
      {selectedDoc && (
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(217, 119, 6, 0.4)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={18} style={{ color: '#fbbf24' }} />
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fef3c7', margin: 0 }}>
                  Chunks for "{selectedDoc.filename}"
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {selectedDocChunks.length} chunk(s) generated · {selectedDoc.character_count.toLocaleString()} total characters
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedDocId(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {selectedDocChunks.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '12px', padding: '16px', textAlign: 'center' }}>
              No chunks generated for this document yet. Click "Index" or "Re-index" to create semantic chunks.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
              {selectedDocChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  style={{
                    backgroundColor: '#090d16',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '11.5px' }}>
                    <span style={{ fontWeight: 600, color: '#fbbf24' }}>Chunk #{chunk.chunk_index + 1}</span>
                    <span style={{ color: '#94a3b8' }}>
                      {chunk.character_count} chars · ~{chunk.token_estimate} tokens {chunk.heading ? `· ${chunk.heading}` : ''}
                    </span>
                  </div>
                  <pre style={{
                    fontSize: '12px',
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    padding: '8px 10px',
                    borderRadius: '6px'
                  }}>
                    {chunk.text}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
