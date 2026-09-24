// Offline Study AI - Knowledge Base & Local RAG View (Phase 3B Part 10)
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
  ExternalLink
} from 'lucide-react';
import { ragService } from '../../../rag';
import { RAGIndexingStats, RAGSearchResult } from '../../../rag/types';
import { chatService } from '../../../ai/chatService';
import { getAllDocuments, DBDocument } from '../../../database/db';

export function KnowledgeBaseView() {
  const [stats, setStats] = useState<RAGIndexingStats>({
    totalDocuments: 0,
    indexedDocuments: 0,
    indexingDocuments: 0,
    failedDocuments: 0,
    totalChunks: 0,
    embeddedChunks: 0
  });
  const [documents, setDocuments] = useState<DBDocument[]>([]);
  const [useStudyMaterials, setUseStudyMaterials] = useState<boolean>(true);
  const [testQuery, setTestQuery] = useState<string>('What is process scheduling?');
  const [searchResults, setSearchResults] = useState<RAGSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isIndexingAll, setIsIndexingAll] = useState<boolean>(false);
  const [indexingDocId, setIndexingDocId] = useState<string | null>(null);

  const refreshData = () => {
    try {
      const currentStats = ragService.getIndexingStats();
      setStats(currentStats);
      const docs = getAllDocuments();
      setDocuments(docs);
      setUseStudyMaterials(chatService.isStudyMaterialsEnabled());
    } catch (err) {
      console.error('Failed to load knowledge base data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

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
    try {
      await ragService.indexDocument(docId);
      refreshData();
    } catch (err) {
      console.error('Index document failed:', err);
    } finally {
      setIndexingDocId(null);
    }
  };

  const handleIndexAll = async () => {
    setIsIndexingAll(true);
    try {
      await ragService.indexAllPendingDocuments();
      refreshData();
    } catch (err) {
      console.error('Index all failed:', err);
    } finally {
      setIsIndexingAll(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(217, 119, 6, 0.35)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)'
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
            <RefreshCw size={14} className={isIndexingAll ? 'spin' : ''} />
            <span>{isIndexingAll ? 'Indexing...' : 'Index Pending'}</span>
          </button>
        </div>
      </div>

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
            {isSearching ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
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

      {/* Documents Status Table */}
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', margin: '0 0 14px 0' }}>
          Document Indexing Status
        </h3>

        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '13px' }}>
            No documents imported yet. Go to the Documents tab to import PDF, DOCX, TXT, or code files.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)', color: '#94a3b8' }}>
                  <th style={{ padding: '8px 12px' }}>Document</th>
                  <th style={{ padding: '8px 12px' }}>Type</th>
                  <th style={{ padding: '8px 12px' }}>Characters</th>
                  <th style={{ padding: '8px 12px' }}>Extraction</th>
                  <th style={{ padding: '8px 12px' }}>Index Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const isThisIndexing = indexingDocId === doc.id;
                  const isIndexed = doc.indexing_status === 'Indexed';
                  const isFailed = doc.indexing_status === 'Index Failed' || doc.extraction_status === 'Failed';

                  return (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#f8fafc'
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                        {doc.filename}
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
                          {isThisIndexing && <RefreshCw size={12} className="spin" />}
                          {isFailed && <AlertCircle size={12} />}
                          {isThisIndexing ? 'Indexing...' : (doc.indexing_status || 'Ready')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
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
}
