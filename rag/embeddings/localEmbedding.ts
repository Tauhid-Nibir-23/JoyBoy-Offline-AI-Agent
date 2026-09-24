// Offline Study AI - Local Semantic Embedding Provider (Phase 3B)
import { EmbeddingProvider } from '../types';

export class LocalSemanticEmbeddingProvider implements EmbeddingProvider {
  public readonly id = 'local_semantic_v1';
  public readonly name = 'Local Semantic Vectorizer (256-d)';
  public readonly dimension = 256;

  // Common stop words to downweight non-informative query tokens
  private readonly stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as',
    'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could',
    'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
    'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
    'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
    'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves',
    'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
    'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to',
    'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while',
    'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
  ]);

  /**
   * Deterministic 32-bit FNV-1a hashing function
   */
  private hashString(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Generates a 256-dimensional normalized semantic embedding vector
   */
  public async embedText(text: string): Promise<number[]> {
    const vector = new Float32Array(this.dimension);
    if (!text || text.trim().length === 0) {
      return Array.from(vector);
    }

    const cleaned = text.toLowerCase().replace(/[^a-z0-9_\-\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);

    // 1. Unigram tokens with length and significance weighting
    for (const token of tokens) {
      const isStop = this.stopWords.has(token);
      const weight = isStop ? 0.2 : (1.0 + Math.log(token.length + 1));
      const bucket = this.hashString(token) % this.dimension;
      const sign = (this.hashString(token + '_sign') % 2 === 0) ? 1 : -1;
      vector[bucket] += sign * weight;

      // Subword character n-grams (3-grams and 4-grams) for morphological similarity
      if (!isStop && token.length >= 4) {
        for (let i = 0; i <= token.length - 3; i++) {
          const gram3 = token.slice(i, i + 3);
          const gramBucket = this.hashString('g3_' + gram3) % this.dimension;
          vector[gramBucket] += 0.35;
        }
      }
    }

    // 2. Bigrams for technical phrase matching (e.g., "round robin", "virtual memory")
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]}_${tokens[i + 1]}`;
      const bucket = this.hashString('bi_' + bigram) % this.dimension;
      const sign = (this.hashString(bigram + '_sign') % 2 === 0) ? 1 : -1;
      vector[bucket] += sign * 1.8;
    }

    // 3. L2 Normalize vector so dot-product equals cosine similarity
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] /= norm;
      }
    }

    return Array.from(vector);
  }

  /**
   * Batch embedding of multiple texts
   */
  public async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }

  /**
   * Compute cosine similarity between two normalized vectors
   */
  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== this.dimension || vecB.length !== this.dimension) {
      return 0;
    }
    let dot = 0;
    for (let i = 0; i < this.dimension; i++) {
      dot += vecA[i] * vecB[i];
    }
    return Math.max(-1, Math.min(1, dot));
  }
}

export const defaultEmbeddingProvider = new LocalSemanticEmbeddingProvider();
