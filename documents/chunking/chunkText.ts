// Offline Study AI - Document Chunker (Phase 3B)
import { normalizeDocumentText } from './normalizeText';
import { estimateTokenCount } from './tokenEstimate';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS, DocumentChunk, ChunkingResult } from './types';

interface AtomicBlock {
  text: string;
  startOffset: number;
  endOffset: number;
  heading?: string | null;
  pageNumber?: number | null;
}

/**
 * Splits document text into structural atomic blocks (paragraphs, headers, or sentences for large blocks).
 */
function extractAtomicBlocks(
  text: string,
  opts: ChunkingOptions
): AtomicBlock[] {
  const rawParagraphs = text.split(/\n\n+/);
  const blocks: AtomicBlock[] = [];
  let currentOffset = 0;
  let activeHeading: string | null = null;
  let activePage = 1;

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Find actual start offset in text from currentOffset
    const startIdx = text.indexOf(para, currentOffset);
    const endIdx = startIdx !== -1 ? startIdx + para.length : currentOffset + para.length;
    currentOffset = endIdx;

    // Check if this paragraph is a Markdown or standalone heading
    const headingMatch = trimmed.match(/^#{1,6}\s+([^\n]+)$/) || 
      (trimmed.length < 80 && !trimmed.endsWith('.') && !trimmed.includes('\n') && /^[A-Z0-9]/.test(trimmed) ? [null, trimmed] : null);

    if (headingMatch && headingMatch[1]) {
      activeHeading = headingMatch[1].trim();
    }

    // Check if paragraph contains page markers
    const pageMatch = trimmed.match(/(?:---\s*Page\s*(\d+)\s*---)|(?:\[Page\s*(\d+)\])/i);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1] || pageMatch[2], 10);
      if (!isNaN(pageNum)) activePage = pageNum;
    }

    // If paragraph is within target size, add as atomic block
    if (trimmed.length <= opts.targetSize) {
      blocks.push({
        text: trimmed,
        startOffset: startIdx !== -1 ? startIdx : 0,
        endOffset: endIdx,
        heading: activeHeading,
        pageNumber: activePage
      });
    } else {
      // Split large paragraph into sentences
      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      let sOffset = startIdx !== -1 ? startIdx : 0;

      for (const sentence of sentences) {
        const sTrimmed = sentence.trim();
        if (!sTrimmed) continue;

        // If sentence is still larger than maxSize, split by words
        if (sTrimmed.length > opts.maxSize) {
          const words = sTrimmed.split(/\s+/);
          let subWordBuf: string[] = [];
          let subWordLen = 0;

          for (const word of words) {
            if (subWordLen + word.length + 1 > opts.targetSize && subWordBuf.length > 0) {
              const subText = subWordBuf.join(' ');
              blocks.push({
                text: subText,
                startOffset: sOffset,
                endOffset: sOffset + subText.length,
                heading: activeHeading,
                pageNumber: activePage
              });
              sOffset += subText.length + 1;
              subWordBuf = [word];
              subWordLen = word.length;
            } else {
              subWordBuf.push(word);
              subWordLen += word.length + 1;
            }
          }
          if (subWordBuf.length > 0) {
            const subText = subWordBuf.join(' ');
            blocks.push({
              text: subText,
              startOffset: sOffset,
              endOffset: sOffset + subText.length,
              heading: activeHeading,
              pageNumber: activePage
            });
            sOffset += subText.length + 1;
          }
        } else {
          blocks.push({
            text: sTrimmed,
            startOffset: sOffset,
            endOffset: sOffset + sTrimmed.length,
            heading: activeHeading,
            pageNumber: activePage
          });
          sOffset += sTrimmed.length + 1;
        }
      }
    }
  }

  return blocks;
}

/**
 * Deterministically chunks normalized text into cohesive knowledge segments with structural boundaries and overlap.
 */
export function chunkDocumentText(
  rawText: string,
  documentId: string,
  options?: Partial<ChunkingOptions>,
  documentMetadata?: Record<string, unknown>
): ChunkingResult {
  const opts: ChunkingOptions = {
    ...DEFAULT_CHUNKING_OPTIONS,
    ...options
  };

  const text = normalizeDocumentText(rawText);
  if (!text || text.length === 0) {
    return {
      chunks: [],
      totalChunks: 0,
      totalCharacters: 0,
      totalTokensEstimate: 0
    };
  }

  // If entire document is smaller than target size, return single chunk
  if (text.length <= opts.targetSize) {
    const headingMatch = text.match(/^#{1,6}\s+([^\n]+)/m);
    const singleChunk: DocumentChunk = {
      id: `${documentId}_chunk_0`,
      documentId,
      chunkIndex: 0,
      text,
      startOffset: 0,
      endOffset: text.length,
      characterCount: text.length,
      tokenEstimate: estimateTokenCount(text),
      heading: headingMatch ? headingMatch[1].trim() : null,
      pageNumber: 1,
      metadata: documentMetadata || null
    };

    return {
      chunks: [singleChunk],
      totalChunks: 1,
      totalCharacters: text.length,
      totalTokensEstimate: singleChunk.tokenEstimate
    };
  }

  // 1. Break into structural atomic blocks
  const blocks = extractAtomicBlocks(text, opts);
  if (blocks.length === 0) {
    return {
      chunks: [],
      totalChunks: 0,
      totalCharacters: 0,
      totalTokensEstimate: 0
    };
  }

  // 2. Combine blocks into chunks respecting targetSize and overlap
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  let blockIdx = 0;
  let trailingOverlapPrefix = '';
  let overlapStartOffset = -1;

  while (blockIdx < blocks.length) {
    const chunkBlocks: AtomicBlock[] = [];
    let accumulatedLength = trailingOverlapPrefix ? trailingOverlapPrefix.length + 2 : 0;
    const startBlockIdx = blockIdx;

    while (blockIdx < blocks.length) {
      const b = blocks[blockIdx];
      const addedLen = accumulatedLength > 0 ? b.text.length + 2 : b.text.length;

      if (accumulatedLength + addedLen > opts.targetSize && chunkBlocks.length > 0) {
        break;
      }

      chunkBlocks.push(b);
      accumulatedLength += addedLen;
      blockIdx++;
    }

    if (chunkBlocks.length === 0 && blockIdx < blocks.length) {
      chunkBlocks.push(blocks[blockIdx]);
      blockIdx++;
    }

    const firstBlock = chunkBlocks[0];
    const lastBlock = chunkBlocks[chunkBlocks.length - 1];

    const chunkStartOffset = overlapStartOffset !== -1 ? overlapStartOffset : firstBlock.startOffset;
    const chunkEndOffset = lastBlock.endOffset;

    let fullChunkText = chunkBlocks.map(b => b.text).join('\n\n');
    if (trailingOverlapPrefix) {
      fullChunkText = `${trailingOverlapPrefix}\n\n${fullChunkText}`;
    }
    fullChunkText = fullChunkText.trim();

    if (fullChunkText.length > 0) {
      const primaryHeading = chunkBlocks.find(b => b.heading)?.heading || null;
      const primaryPage = chunkBlocks[0]?.pageNumber || 1;

      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        chunkIndex,
        text: fullChunkText,
        startOffset: chunkStartOffset,
        endOffset: chunkEndOffset,
        characterCount: fullChunkText.length,
        tokenEstimate: estimateTokenCount(fullChunkText),
        heading: primaryHeading,
        pageNumber: primaryPage,
        metadata: documentMetadata || null
      });
      chunkIndex++;
    }

    // Reset trailing overlap
    trailingOverlapPrefix = '';
    overlapStartOffset = -1;

    // Calculate overlap for next chunk
    if (blockIdx < blocks.length && opts.overlap > 0) {
      let overlapAccumulated = 0;
      let stepBackCount = 0;

      if (chunkBlocks.length > 1) {
        for (let i = chunkBlocks.length - 1; i > 0; i--) {
          const blk = chunkBlocks[i];
          if (stepBackCount === 0 && blk.text.length <= Math.max(opts.overlap * 1.5, opts.overlap + 50)) {
            overlapAccumulated += blk.text.length + 2;
            stepBackCount++;
          } else if (overlapAccumulated + blk.text.length <= opts.overlap) {
            overlapAccumulated += blk.text.length + 2;
            stepBackCount++;
          } else {
            break;
          }
        }
      }

      if (stepBackCount > 0 && (blockIdx - stepBackCount) > startBlockIdx) {
        blockIdx -= stepBackCount;
      } else {
        // Fallback to text tail overlap if stepping back blocks wasn't possible
        const lastBlockText = lastBlock.text;
        if (lastBlockText.length > 40) {
          const tailLen = Math.min(opts.overlap, lastBlockText.length);
          const rawTail = lastBlockText.slice(lastBlockText.length - tailLen);
          const firstSpace = rawTail.indexOf(' ');
          if (firstSpace !== -1 && firstSpace < rawTail.length - 10) {
            trailingOverlapPrefix = rawTail.slice(firstSpace + 1).trim();
            overlapStartOffset = lastBlock.endOffset - trailingOverlapPrefix.length;
          }
        }
      }
    }
  }

  // Merge tiny trailing chunk into previous chunk if possible
  if (chunks.length > 1) {
    const lastChunk = chunks[chunks.length - 1];
    const prevChunk = chunks[chunks.length - 2];
    if (lastChunk.characterCount < opts.minSize && prevChunk.characterCount + lastChunk.characterCount <= opts.maxSize) {
      prevChunk.text = `${prevChunk.text}\n\n${lastChunk.text}`;
      prevChunk.endOffset = lastChunk.endOffset;
      prevChunk.characterCount = prevChunk.text.length;
      prevChunk.tokenEstimate = estimateTokenCount(prevChunk.text);
      chunks.pop();
    }
  }

  const totalChars = chunks.reduce((acc, c) => acc + c.characterCount, 0);
  const totalTokens = chunks.reduce((acc, c) => acc + c.tokenEstimate, 0);

  return {
    chunks,
    totalChunks: chunks.length,
    totalCharacters: totalChars,
    totalTokensEstimate: totalTokens
  };
}
