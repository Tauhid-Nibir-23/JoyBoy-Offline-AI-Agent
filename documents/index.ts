export interface LocalDocument {
  id: string;
  name: string;
  fileType: 'pdf' | 'txt' | 'md' | 'docx' | 'code';
  size: number;
  addedAt: string;
}

export class DocumentManager {
  public async listDocuments(): Promise<LocalDocument[]> {
    return [];
  }
}

export const documentManager = new DocumentManager();
