/**
 * Smart document chunking for embeddings
 * Splits documents into semantically meaningful chunks
 */

import { ChunkConfig, DEFAULT_CHUNK_CONFIG } from '../vector-db/schemas';

export interface Chunk {
  text: string;
  index: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Split text by markdown headers
 */
function splitByHeaders(text: string): string[] {
  // Split by markdown headers (##, ###, etc.)
  const headerPattern = /^#{1,6}\s+.+$/gm;
  const sections: string[] = [];
  let lastIndex = 0;

  const matches = Array.from(text.matchAll(headerPattern));

  for (const match of matches) {
    if (match.index !== undefined && match.index > lastIndex) {
      const section = text.slice(lastIndex, match.index).trim();
      if (section) sections.push(section);
    }
    lastIndex = match.index ?? lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const section = text.slice(lastIndex).trim();
    if (section) sections.push(section);
  }

  return sections.length > 0 ? sections : [text];
}

/**
 * Split text by code blocks
 */
function splitByCodeBlocks(text: string): string[] {
  // Split by code blocks (```...```)
  const codeBlockPattern = /```[\s\S]*?```/g;
  const parts: string[] = [];
  let lastIndex = 0;

  const matches = Array.from(text.matchAll(codeBlockPattern));

  for (const match of matches) {
    if (match.index !== undefined) {
      // Text before code block
      const before = text.slice(lastIndex, match.index).trim();
      if (before) parts.push(before);

      // Code block itself
      parts.push(match[0]);

      lastIndex = match.index + match[0].length;
    }
  }

  // Remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) parts.push(remaining);
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Split text by paragraphs
 */
function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Split text by sentences (simple approach)
 */
function splitBySentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Chunk text with overlap
 */
function chunkWithOverlap(
  parts: string[],
  config: ChunkConfig
): Chunk[] {
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let currentIndex = 0;
  let startOffset = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // If adding this part would exceed max size
    if (currentChunk.length + part.length > config.maxChunkSize) {
      // Save current chunk if it's big enough
      if (currentChunk.length >= config.minChunkSize) {
        chunks.push({
          text: currentChunk.trim(),
          index: currentIndex,
          startOffset,
          endOffset: startOffset + currentChunk.length,
        });
        currentIndex++;

        // Keep overlap from the end of current chunk
        const overlapStart = Math.max(0, currentChunk.length - config.chunkOverlap);
        currentChunk = currentChunk.slice(overlapStart);
        startOffset += overlapStart;
      }
    }

    // Add part to current chunk
    currentChunk += (currentChunk ? '\n\n' : '') + part;
  }

  // Save final chunk
  if (currentChunk.trim().length >= config.minChunkSize) {
    chunks.push({
      text: currentChunk.trim(),
      index: currentIndex,
      startOffset,
      endOffset: startOffset + currentChunk.length,
    });
  }

  return chunks;
}

/**
 * Smart chunk document based on structure
 */
export function chunkDocument(
  content: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): Chunk[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  // If content is small enough, return as single chunk
  if (content.length <= config.maxChunkSize) {
    return [
      {
        text: content.trim(),
        index: 0,
        startOffset: 0,
        endOffset: content.length,
      },
    ];
  }

  // Try different splitting strategies in order of preference
  let parts: string[];

  // 1. Try splitting by headers first (best for markdown)
  parts = splitByHeaders(content);

  // 2. If parts are still too large, split by code blocks
  if (parts.some((p) => p.length > config.maxChunkSize)) {
    parts = parts.flatMap(splitByCodeBlocks);
  }

  // 3. If parts are still too large, split by paragraphs
  if (parts.some((p) => p.length > config.maxChunkSize)) {
    parts = parts.flatMap(splitByParagraphs);
  }

  // 4. If parts are still too large, split by sentences
  if (parts.some((p) => p.length > config.maxChunkSize)) {
    parts = parts.flatMap(splitBySentences);
  }

  // 5. Finally, force split any remaining large parts
  parts = parts.flatMap((part) => {
    if (part.length <= config.maxChunkSize) return [part];

    const forcedChunks: string[] = [];
    for (let i = 0; i < part.length; i += config.maxChunkSize - config.chunkOverlap) {
      forcedChunks.push(part.slice(i, i + config.maxChunkSize));
    }
    return forcedChunks;
  });

  // Combine parts into chunks with overlap
  return chunkWithOverlap(parts, config);
}

/**
 * Chunk markdown content preserving structure
 */
export function chunkMarkdown(
  content: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): Chunk[] {
  return chunkDocument(content, config);
}

/**
 * Chunk JSON content (package.json, etc.)
 */
export function chunkJSON(
  content: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): Chunk[] {
  try {
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);

    // For JSON, we keep it as a single chunk if possible
    // Or split by top-level keys
    if (formatted.length <= config.maxChunkSize) {
      return [
        {
          text: formatted,
          index: 0,
          startOffset: 0,
          endOffset: formatted.length,
        },
      ];
    }

    // Split by top-level keys
    const chunks: Chunk[] = [];
    let index = 0;

    for (const [key, value] of Object.entries(parsed)) {
      const chunkContent = JSON.stringify({ [key]: value }, null, 2);
      chunks.push({
        text: chunkContent,
        index: index++,
        startOffset: 0, // Not tracking exact offsets for JSON
        endOffset: chunkContent.length,
      });
    }

    return chunks;
  } catch {
    // If JSON parsing fails, treat as regular text
    return chunkDocument(content, config);
  }
}

/**
 * Chunk TOML content (pyproject.toml, etc.)
 */
export function chunkTOML(
  content: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): Chunk[] {
  // Split by TOML sections [section.name]
  const sectionPattern = /^\[[\w.]+\]$/gm;
  const sections: string[] = [];
  let lastIndex = 0;

  const matches = Array.from(content.matchAll(sectionPattern));

  for (const match of matches) {
    if (match.index !== undefined && match.index > lastIndex) {
      const section = content.slice(lastIndex, match.index).trim();
      if (section) sections.push(section);
    }
    lastIndex = match.index ?? lastIndex;
  }

  if (lastIndex < content.length) {
    const section = content.slice(lastIndex).trim();
    if (section) sections.push(section);
  }

  // Combine small sections or split large ones
  return chunkWithOverlap(
    sections.length > 0 ? sections : [content],
    config
  );
}
