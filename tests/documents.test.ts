import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  getAllDocuments, 
  getDocumentById, 
  getDocumentByHash, 
  deleteDocumentFromDB,
  createConversationInDB,
  insertMessageInDB,
  getAllConversations,
  getMessagesByConversationId,
  getDatabaseStatus
} from '../database/db';
import { 
  documentService, 
  calculateSHA256, 
  detectFileType 
} from '../documents/documentService';
import { extractTextFromBuffer } from '../documents/extractors/textExtractor';
import { extractPdfFromBuffer } from '../documents/extractors/pdfExtractor';
import { extractDocxFromBuffer } from '../documents/extractors/docxExtractor';
import JSZip from 'jszip';

function strToBuffer(str: string): ArrayBuffer {
  const uint8 = new TextEncoder().encode(str);
  return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
}

describe('Phase 3A — Local Document Management & Text Extraction Tests', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  // 1. Importing TXT
  it('1. imports a .txt document and extracts readable text', async () => {
    const text = 'Operating Systems Lecture Notes: CPU Scheduling and Memory Management.';
    const buffer = strToBuffer(text);

    const res = await documentService.importBuffer('lecture_notes.txt', buffer);
    expect(res.success).toBe(true);
    expect(res.document).toBeDefined();
    expect(res.document?.file_type).toBe('txt');
    expect(res.document?.extraction_status).toBe('Ready');
    expect(res.document?.extracted_text).toBe(text);
    expect(res.document?.character_count).toBe(text.length);
  });

  // 2. Importing Markdown
  it('2. imports a .md Markdown document and extracts content', async () => {
    const md = '# Binary Trees\n\nA binary tree is a hierarchical data structure.\n\n- Root\n- Leaves';
    const buffer = strToBuffer(md);

    const res = await documentService.importBuffer('trees.md', buffer);
    expect(res.success).toBe(true);
    expect(res.document?.file_type).toBe('md');
    expect(res.document?.extraction_status).toBe('Ready');
    expect(res.document?.extracted_text).toBe(md);
    expect(res.document?.character_count).toBe(md.length);
  });

  // 3. Importing source code files (.py, .ts, .json) without execution
  it('3. imports source code files and extracts code content safely', async () => {
    // Python
    const pyCode = 'def bubble_sort(arr):\n    n = len(arr)\n    return sorted(arr)';
    const pyRes = await documentService.importBuffer('sort.py', strToBuffer(pyCode));
    expect(pyRes.success).toBe(true);
    expect(pyRes.document?.file_type).toBe('py');
    expect(pyRes.document?.extracted_text).toBe(pyCode);

    // TypeScript
    const tsCode = 'export interface Student {\n  id: string;\n  grade: number;\n}';
    const tsRes = await documentService.importBuffer('student.ts', strToBuffer(tsCode));
    expect(tsRes.success).toBe(true);
    expect(tsRes.document?.file_type).toBe('ts');
    expect(tsRes.document?.extracted_text).toBe(tsCode);

    // JSON
    const jsonCode = '{\n  "course": "CS101",\n  "credits": 4\n}';
    const jsonRes = await documentService.importBuffer('course.json', strToBuffer(jsonCode));
    expect(jsonRes.success).toBe(true);
    expect(jsonRes.document?.file_type).toBe('json');
    expect(jsonRes.document?.extracted_text).toBe(jsonCode);
  });

  // 4. Duplicate detection using SHA-256
  it('4. detects duplicates via SHA-256 and prevents duplicate database records', async () => {
    const content = 'Unique Content For Duplicate Test 12345';
    const buffer = strToBuffer(content);

    const firstImport = await documentService.importBuffer('original.txt', buffer);
    expect(firstImport.success).toBe(true);
    const hash = firstImport.document?.file_hash;
    expect(hash).toBeDefined();

    // Re-import identical content with different filename
    const secondImport = await documentService.importBuffer('copy_of_original.txt', buffer);
    expect(secondImport.success).toBe(false);
    expect(secondImport.isDuplicate).toBe(true);
    expect(secondImport.error).toContain('already been imported');
    expect(secondImport.document?.id).toBe(firstImport.document?.id);

    // Verify database only has 1 record for this hash
    const allDocs = await documentService.listDocuments();
    const matches = allDocs.filter(d => d.file_hash === hash);
    expect(matches.length).toBe(1);
  });

  // 5. Document database insertion
  it('5. inserts and stores document metadata in SQLite database', async () => {
    const text = 'Direct DB insertion test';
    const buffer = strToBuffer(text);
    const hash = await calculateSHA256(buffer);

    const doc = await documentService.importBuffer('db_insert.txt', buffer, {
      originalPath: '/test/path/db_insert.txt'
    });
    expect(doc.success).toBe(true);
    expect(doc.document?.id).toBeDefined();

    const fromDb = getDocumentById(doc.document!.id);
    expect(fromDb).not.toBeNull();
    expect(fromDb?.filename).toBe('db_insert.txt');
    expect(fromDb?.original_path).toBe('/test/path/db_insert.txt');
    expect(fromDb?.file_hash).toBe(hash);
  });

  // 6. Document retrieval
  it('6. retrieves documents by ID, hash, and in full list', async () => {
    const text = 'Retrieval Test Content';
    const buffer = strToBuffer(text);
    const res = await documentService.importBuffer('retrieve.txt', buffer);
    const docId = res.document!.id;
    const docHash = res.document!.file_hash;

    // By ID
    const byId = await documentService.getDocument(docId);
    expect(byId).not.toBeNull();
    expect(byId?.id).toBe(docId);

    // By Hash
    const byHash = getDocumentByHash(docHash);
    expect(byHash).not.toBeNull();
    expect(byHash?.id).toBe(docId);

    // In full list
    const list = await documentService.listDocuments();
    expect(list.some(d => d.id === docId)).toBe(true);
  });

  // 7. Document deletion
  it('7. deletes document from database successfully', async () => {
    const text = 'Document To Be Deleted';
    const buffer = strToBuffer(text);
    const res = await documentService.importBuffer('delete_me.txt', buffer);
    const docId = res.document!.id;

    expect(await documentService.getDocument(docId)).not.toBeNull();

    const ok = await documentService.deleteDocument(docId);
    expect(ok).toBe(true);

    expect(await documentService.getDocument(docId)).toBeNull();
    expect(getDocumentById(docId)).toBeNull();
  });

  // 8. Extraction failure handling
  it('8. handles unsupported file types and extraction failures gracefully', async () => {
    // Unsupported format
    const unsupportedRes = await documentService.importBuffer('binary.exe', new ArrayBuffer(10));
    expect(unsupportedRes.success).toBe(false);
    expect(unsupportedRes.error).toContain('Unsupported file format');

    // Corrupt docx file
    const corruptBuffer = strToBuffer('NOT_A_REAL_DOCX_FILE_JUST_RANDOM_GARBAGE');
    const corruptDocxRes = await documentService.importBuffer('corrupted.docx', corruptBuffer);
    expect(corruptDocxRes.success).toBe(false);
    expect(corruptDocxRes.document?.extraction_status).toBe('Failed');
    expect(corruptDocxRes.document?.error_message).toBeDefined();
  });

  // 9. Database schema migration compatibility
  it('9. verifies database schema has all required tables including documents', async () => {
    const ok = await initDatabase();
    expect(ok).toBe(true);

    const status = getDatabaseStatus();
    expect(status.initialized).toBe(true);
    expect(status.tables).toContain('settings');
    expect(status.tables).toContain('conversations');
    expect(status.tables).toContain('messages');
    expect(status.tables).toContain('documents');
  });

  // 10. Existing conversations and messages still work
  it('10. verifies existing conversations and messages are unaffected by documents', async () => {
    const convId = 'conv_phase3_test';
    createConversationInDB(convId, 'Phase 3 Regression Check');

    const msg = insertMessageInDB({
      id: 'msg_phase3_1',
      conversation_id: convId,
      role: 'user',
      content: 'Is SQLite still working perfectly with documents table?',
      created_at: new Date().toISOString()
    });

    expect(msg.content).toBe('Is SQLite still working perfectly with documents table?');

    const convs = getAllConversations();
    expect(convs.some(c => c.id === convId)).toBe(true);

    const msgs = getMessagesByConversationId(convId);
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('Is SQLite still working perfectly with documents table?');
  });

  // 11. PDF Extraction with valid fixture
  it('11. extracts text from a PDF document fixture', async () => {
    const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 12 Tf 72 712 Td (Hello PDF World) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000338 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
417
%%EOF`;
    const buffer = strToBuffer(minimalPdf);

    const res = await documentService.importBuffer('study_guide.pdf', buffer);
    expect(res.success).toBe(true);
    expect(res.document?.file_type).toBe('pdf');
    expect(res.document?.extraction_status).toBe('Ready');
    expect(res.document?.extracted_text).toContain('Hello PDF World');
    expect(res.document?.character_count).toBeGreaterThan(0);
  });

  // 12. DOCX Extraction with valid fixture
  it('12. extracts text from a DOCX document fixture', async () => {
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
    <w:p>
      <w:r>
        <w:t>Offline Study AI DOCX Ingestion Test</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`);

    const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const res = await documentService.importBuffer('assignment.docx', arrayBuffer);

    expect(res.success).toBe(true);
    expect(res.document?.file_type).toBe('docx');
    expect(res.document?.extraction_status).toBe('Ready');
    expect(res.document?.extracted_text).toContain('Offline Study AI DOCX Ingestion Test');
    expect(res.document?.character_count).toBeGreaterThan(0);
  });
});
