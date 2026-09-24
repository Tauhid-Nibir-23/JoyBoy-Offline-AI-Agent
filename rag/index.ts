export interface RAGDocumentChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, any>;
}

export class LocalRAG {
  public async search(query: string): Promise<RAGDocumentChunk[]> {
    console.log('[RAG Stub] Query requested:', query);
    return [];
  }
}

export const localRAG = new LocalRAG();
