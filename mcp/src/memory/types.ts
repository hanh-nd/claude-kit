export interface MemoryChunk {
  id: string;
  source: string;
  heading: string;
  headingLevel: number;
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface SearchResult {
  chunk: MemoryChunk;
  score: number;
  retriever: 'dense' | 'bm25' | 'both';
}

export interface MemoryConfig {
  enabled: boolean;
  memoryDir: string;
  topK: number;
  chunkSize: number;
  overlapLines: number;
  embeddingModel: string;
  vectorDimension: number;
}

export interface IndexStats {
  indexed: number;
  deleted: number;
  skipped: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: false,
  memoryDir: '',
  topK: 5,
  chunkSize: 1500,
  overlapLines: 2,
  embeddingModel: 'Xenova/bge-small-en-v1.5',
  vectorDimension: 384,
};
