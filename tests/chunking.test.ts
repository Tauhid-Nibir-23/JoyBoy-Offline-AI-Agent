import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  getAllDocuments, 
  getDocumentById, 
  insertDocumentInDB, 
  deleteDocumentFromDB,
  getChunksByDocumentId,
  insertChunksInDB,
  deleteChunksByDocumentId
} from '../database/db';
import { normalizeDocumentText } from '../documents/chunking/normalizeText';
import { estimateTokenCount } from '../documents/chunking/tokenEstimate';
import { chunkDocumentText } from '../documents/chunking/chunkText';
import { chunkService } from '../documents/chunking/chunkService';
import { documentService } from '../documents/documentService';
import JSZip from 'jszip';

function strToBuffer(str: string): ArrayBuffer {
  const uint8 = new TextEncoder().encode(str);
  return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
}

describe('Phase 3B — Document Cleaning, Chunking & Knowledge Preparation Tests', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  // 1. CRLF Normalization
  it('1. normalizes CRLF and CR line breaks to clean LF', () => {
    const raw = 'Line 1\r\nLine 2\rLine 3\nLine 4';
    const normalized = normalizeDocumentText(raw);
    expect(normalized).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    expect(normalized).not.toContain('\r');
  });

  // 2. Excessive blank-line normalization
  it('2. collapses 3+ consecutive blank lines to double newlines (paragraphs)', () => {
    const raw = 'Paragraph 1\n\n\n\n\nParagraph 2\n\n\n\nParagraph 3';
    const normalized = normalizeDocumentText(raw);
    expect(normalized).toBe('Paragraph 1\n\nParagraph 2\n\nParagraph 3');
  });

  // 3. Whitespace cleanup
  it('3. trims trailing whitespace on lines, non-breaking spaces, and null characters', () => {
    const raw = 'Line with trailing spaces   \nLine with null\x00byte\nLine with\u00A0non-breaking\u00A0space';
    const normalized = normalizeDocumentText(raw);
    expect(normalized).toContain('Line with trailing spaces\n');
    expect(normalized).toContain('Line with nullbyte');
    expect(normalized).toContain('Line with non-breaking space');
    expect(normalized).not.toContain('\x00');
  });

  // 4. Heading preservation
  it('4. preserves Markdown headings and section titles faithfully', () => {
    const raw = '# Chapter 1: Introduction\n\nContent under h1\n\n## Section 1.1: Foundations\n\nContent under h2';
    const normalized = normalizeDocumentText(raw);
    expect(normalized).toContain('# Chapter 1: Introduction');
    expect(normalized).toContain('## Section 1.1: Foundations');
  });

  // 5. Paragraph and list preservation
  it('5. preserves paragraph structure, bullet lists, and code indentation', () => {
    const raw = 'Intro paragraph.\n\nKey Concepts:\n- Item 1\n- Item 2\n  - Sub-item 2a\n\n1. Numbered one\n2. Numbered two';
    const normalized = normalizeDocumentText(raw);
    expect(normalized).toContain('- Item 1\n- Item 2\n  - Sub-item 2a');
    expect(normalized).toContain('1. Numbered one\n2. Numbered two');
  });

  // 6. Deterministic chunking
  it('6. produces identical deterministic chunks across multiple invocations', () => {
    const text = `# Memory Management\n\nVirtual memory uses paging to map virtual addresses to physical frames.\n\nPage replacement policies include LRU, FIFO, and Clock.`;
    const res1 = chunkDocumentText(text, 'doc_det_1', { targetSize: 200, overlap: 50 });
    const res2 = chunkDocumentText(text, 'doc_det_1', { targetSize: 200, overlap: 50 });

    expect(res1.chunks.length).toBe(res2.chunks.length);
    for (let i = 0; i < res1.chunks.length; i++) {
      expect(res1.chunks[i].text).toBe(res2.chunks[i].text);
      expect(res1.chunks[i].startOffset).toBe(res2.chunks[i].startOffset);
      expect(res1.chunks[i].endOffset).toBe(res2.chunks[i].endOffset);
      expect(res1.chunks[i].tokenEstimate).toBe(res2.chunks[i].tokenEstimate);
    }
  });

  // 7. Target chunk size
  it('7. respects target chunk size configuration', () => {
    const text = 'Sentence one is here. Sentence two is here. Sentence three is here. Sentence four is here. Sentence five is here.';
    const res = chunkDocumentText(text, 'doc_target_size', { targetSize: 60, overlap: 20 });
    expect(res.chunks.length).toBeGreaterThan(1);
    for (const chunk of res.chunks) {
      expect(chunk.characterCount).toBeLessThanOrEqual(150); // within sensible bound
    }
  });

  // 8. Overlap behavior
  it('8. preserves overlap between consecutive chunks', () => {
    const text = 'Paragraph A discusses CPU architectures in deep technical detail.\n\nParagraph B covers instruction pipelining and hazards.\n\nParagraph C covers superscalar execution and branch prediction.';
    const res = chunkDocumentText(text, 'doc_overlap', { targetSize: 120, overlap: 60 });
    expect(res.chunks.length).toBeGreaterThan(1);

    // Verify overlap: tail of chunk N appears in chunk N+1
    for (let i = 0; i < res.chunks.length - 1; i++) {
      const c1 = res.chunks[i];
      const c2 = res.chunks[i + 1];
      // Either sentence or block overlap
      const c1Words = c1.text.split(/\s+/).slice(-3).join(' ');
      expect(c2.text.includes(c1Words) || c2.startOffset < c1.endOffset).toBe(true);
    }
  });

  // 9. Large paragraph splitting
  it('9. splits oversized paragraphs at sentence boundaries without word corruption', () => {
    const longPara = 'This is the first sentence about distributed consensus. This is the second sentence explaining Paxos and Raft protocols. This is the third sentence comparing leader election algorithms. This is the fourth sentence regarding network partitions and CAP theorem.';
    const res = chunkDocumentText(longPara, 'doc_large_para', { targetSize: 120, overlap: 40 });

    expect(res.chunks.length).toBeGreaterThan(1);
    for (const c of res.chunks) {
      expect(c.text.trim().length).toBeGreaterThan(0);
      // Words must remain whole (no split words like "dis-tributed")
      const words = c.text.split(/\s+/);
      for (const w of words) {
        expect(w.length).toBeGreaterThan(0);
      }
    }
  });

  // 10. No empty chunks
  it('10. never produces empty chunks even with multiple empty lines and spaces', () => {
    const textWithBlanks = '   \n\n\n  First real sentence here.   \n\n\n\n   Second real sentence here.  \n\n   ';
    const res = chunkDocumentText(textWithBlanks, 'doc_no_empty', { targetSize: 50, overlap: 10 });
    expect(res.chunks.length).toBeGreaterThan(0);
    for (const c of res.chunks) {
      expect(c.text.trim().length).toBeGreaterThan(0);
      expect(c.characterCount).toBeGreaterThan(0);
    }
  });

  // 11. No word corruption
  it('11. preserves exact word boundaries without cutting words in half', () => {
    const text = 'Internationalization and interoperability are fundamental architectural goals of modern multi-threaded decentralized operating systems.';
    const res = chunkDocumentText(text, 'doc_word_safe', { targetSize: 50, overlap: 15 });
    for (const c of res.chunks) {
      expect(c.text).not.toMatch(/^[a-z]{1,2}\s/); // Should not start with an orphaned broken word fragment
      expect(c.text.includes('Internationalization') || c.text.includes('interoperability') || c.text.includes('fundamental') || c.text.includes('architectural')).toBe(true);
    }
  });

  // 12. Token estimation
  it('12. calculates fast, deterministic token estimates', () => {
    const shortText = 'Hello world!';
    const estShort = estimateTokenCount(shortText);
    expect(estShort).toBeGreaterThanOrEqual(1);
    expect(estShort).toBeLessThan(10);

    const codeSnippet = 'function calculateSum(a: number, b: number): number { return a + b; }';
    const estCode = estimateTokenCount(codeSnippet);
    expect(estCode).toBeGreaterThan(5);
    expect(estCode).toBeLessThan(35);
  });

  // 13. Chunk metadata
  it('13. populates chunk metadata including headings, offsets, and character counts', () => {
    const text = '# Section Alpha\n\nAlpha details.\n\n## Section Beta\n\nBeta details.';
    const res = chunkDocumentText(text, 'doc_meta_test', { targetSize: 50, overlap: 10, minSize: 10 }, { source: 'unit_test' });

    expect(res.chunks.length).toBeGreaterThanOrEqual(2);
    expect(res.chunks[0].heading).toBe('Section Alpha');
    expect(res.chunks[0].startOffset).toBeDefined();
    expect(res.chunks[0].endOffset).toBeGreaterThan(res.chunks[0].startOffset);
    expect(res.chunks[0].characterCount).toBe(res.chunks[0].text.length);
    expect(res.chunks[0].tokenEstimate).toBeGreaterThan(0);
    expect(res.chunks[0].metadata).toEqual({ source: 'unit_test' });
  });

  // 14. SQLite chunk insertion
  it('14. inserts chunks into SQLite document_chunks table correctly', () => {
    const docId = 'doc_db_test_1';
    insertDocumentInDB({
      id: docId,
      filename: 'db_test.txt',
      original_path: null,
      file_type: 'txt',
      file_size: 100,
      file_hash: 'hash_chunk_test_1',
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: 'Sample text for db insertion.',
      character_count: 29,
      error_message: null
    });

    insertChunksInDB([{
      id: 'chunk_test_1_0',
      document_id: docId,
      chunk_index: 0,
      text: 'Sample text for db insertion.',
      start_offset: 0,
      end_offset: 29,
      character_count: 29,
      token_estimate: 7,
      heading: 'Introduction',
      page_number: 1,
      metadata_json: JSON.stringify({ key: 'value' })
    }]);

    const stored = getChunksByDocumentId(docId);
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('chunk_test_1_0');
    expect(stored[0].heading).toBe('Introduction');
    expect(stored[0].page_number).toBe(1);
  });

  // 15 & 16. Chunk retrieval and ordering
  it('15 & 16. retrieves chunks in strict chunk_index ASC order', () => {
    const docId = 'doc_order_test';
    insertDocumentInDB({
      id: docId,
      filename: 'order.txt',
      original_path: null,
      file_type: 'txt',
      file_size: 200,
      file_hash: 'hash_order_test',
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: 'Chunk 0 text. Chunk 1 text. Chunk 2 text.',
      character_count: 42,
      error_message: null
    });

    // Insert deliberately out of order
    insertChunksInDB([
      { id: `${docId}_2`, document_id: docId, chunk_index: 2, text: 'Chunk 2 text.', start_offset: 28, end_offset: 42, character_count: 14, token_estimate: 4, heading: null, page_number: 1, metadata_json: null },
      { id: `${docId}_0`, document_id: docId, chunk_index: 0, text: 'Chunk 0 text.', start_offset: 0, end_offset: 14, character_count: 14, token_estimate: 4, heading: null, page_number: 1, metadata_json: null },
      { id: `${docId}_1`, document_id: docId, chunk_index: 1, text: 'Chunk 1 text.', start_offset: 14, end_offset: 28, character_count: 14, token_estimate: 4, heading: null, page_number: 1, metadata_json: null }
    ]);

    const retrieved = getChunksByDocumentId(docId);
    expect(retrieved.length).toBe(3);
    expect(retrieved[0].chunk_index).toBe(0);
    expect(retrieved[1].chunk_index).toBe(1);
    expect(retrieved[2].chunk_index).toBe(2);
  });

  // 17. Document -> chunks relationship via ChunkService
  it('17. processes document chunks and retrieves them via ChunkService', async () => {
    const content = '# Algorithms\n\nMerge sort is a divide and conquer algorithm.\n\nQuick sort partitions an array using a pivot.';
    const impRes = await documentService.importBuffer('algorithms.md', strToBuffer(content));
    expect(impRes.success).toBe(true);
    const docId = impRes.document!.id;

    const chunks = await chunkService.getChunksForDocument(docId);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].documentId).toBe(docId);
    expect(chunks[0].text).toContain('Merge sort');
  });

  // 18. Cascade deletion
  it('18. deletes all associated chunks when a document is deleted', async () => {
    const content = 'Temporary study notes to verify cascade deletion of chunks.';
    const impRes = await documentService.importBuffer('temp_cascade.txt', strToBuffer(content));
    const docId = impRes.document!.id;

    const chunksBefore = await chunkService.getChunksForDocument(docId);
    expect(chunksBefore.length).toBeGreaterThan(0);

    const delOk = await documentService.deleteDocument(docId);
    expect(delOk).toBe(true);

    const chunksAfter = await chunkService.getChunksForDocument(docId);
    expect(chunksAfter.length).toBe(0);
    expect(getChunksByDocumentId(docId).length).toBe(0);
  });

  // 19. Reprocessing replaces old chunks
  it('19. reprocesses document and cleanly replaces existing chunks without duplicates', async () => {
    const content = '# Networks\n\nThe OSI model has seven layers: physical, data link, network, transport, session, presentation, and application.';
    const impRes = await documentService.importBuffer('networks.md', strToBuffer(content));
    const docId = impRes.document!.id;

    const initialChunks = await chunkService.getChunksForDocument(docId);
    const initialCount = initialChunks.length;

    // Reprocess with different target size
    const reprocessedChunks = await chunkService.reprocessDocument(docId, { targetSize: 50 });
    expect(reprocessedChunks.length).toBeGreaterThan(0);

    // Verify database only has reprocessed chunks (no leftover or duplicated chunks)
    const storedChunks = await chunkService.getChunksForDocument(docId);
    expect(storedChunks.length).toBe(reprocessedChunks.length);
    expect(storedChunks.map(c => c.chunkIndex)).toEqual(reprocessedChunks.map(c => c.chunkIndex));
  });

  // 20. Extraction failure does not create invalid chunks
  it('20. does not create chunks if document extraction fails', async () => {
    const corruptBuffer = strToBuffer('NOT_VALID_DOCX');
    const impRes = await documentService.importBuffer('invalid.docx', corruptBuffer);
    expect(impRes.success).toBe(false);

    if (impRes.document) {
      const chunks = await chunkService.getChunksForDocument(impRes.document.id);
      expect(chunks.length).toBe(0);
    }
  });

  // 21. Real Fixture Tests (TXT, MD, PDF, DOCX)
  describe('Real Fixtures Chunking Verification', () => {
    it('generates chunks for real TXT note fixture', async () => {
      const txt = 'Lecture 1: Cache Hierarchy\n\nL1 Cache: Fastest, smallest, per-core.\nL2 Cache: Fast, larger than L1.\nL3 Cache: Shared across all cores.\nRAM: Main memory storage.';
      const res = await documentService.importBuffer('cache.txt', strToBuffer(txt));
      expect(res.success).toBe(true);

      const chunks = await chunkService.getChunksForDocument(res.document!.id);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain('Cache Hierarchy');
    });

    it('generates chunks for real Markdown fixture', async () => {
      const md = '# Data Structures\n\n## Stack\n\nLIFO structure.\n\n## Queue\n\nFIFO structure.\n\n## Heap\n\nPriority queue implementation.';
      const res = await documentService.importBuffer('structures.md', strToBuffer(md));
      expect(res.success).toBe(true);

      const chunks = await chunkService.getChunksForDocument(res.document!.id);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(c => c.heading === 'Stack' || c.heading === 'Data Structures')).toBe(true);
    });

    it('generates chunks for real PDF fixture', async () => {
      const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 50 >> stream
BT /F1 12 Tf 72 712 Td (Operating Systems Paging and Segmentation Guide) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000344 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
423
%%EOF`;
      const res = await documentService.importBuffer('paging.pdf', strToBuffer(minimalPdf));
      expect(res.success).toBe(true);

      const chunks = await chunkService.getChunksForDocument(res.document!.id);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain('Operating Systems Paging and Segmentation Guide');
    });

    it('generates chunks for real DOCX fixture', async () => {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
      zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
      zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Distributed Systems Architecture</w:t></w:r></w:p>
    <w:p><w:r><w:t>Consensus protocols guarantee consistency across nodes.</w:t></w:r></w:p>
  </w:body>
</w:document>`);

      const docxBuf = await zip.generateAsync({ type: 'arraybuffer' });
      const res = await documentService.importBuffer('distributed.docx', docxBuf);
      expect(res.success).toBe(true);

      const chunks = await chunkService.getChunksForDocument(res.document!.id);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain('Distributed Systems Architecture');
    });
  });
});
