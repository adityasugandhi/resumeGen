/**
 * POST /api/knowledge/search
 * Search project knowledge base using vector similarity
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchDocuments } from '@/lib/vector-db';
import { generateQueryEmbedding } from '@/lib/indexer';
import { SearchFilters } from '@/lib/vector-db/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      topK = 10,
      filters,
    }: {
      query: string;
      topK?: number;
      filters?: SearchFilters;
    } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      );
    }

    if (query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query cannot be empty' },
        { status: 400 }
      );
    }

    console.log(`Searching for: "${query}" (topK: ${topK})`);

    // Generate embedding for the query
    const queryVector = await generateQueryEmbedding(query);

    // Search the database
    const results = await searchDocuments(queryVector, topK, filters);

    // Format results for response
    const formattedResults = results.map((result) => ({
      id: result.document.id,
      projectName: result.document.projectName,
      filePath: result.document.filePath,
      fileType: result.document.fileType,
      chunk: result.document.chunk,
      chunkIndex: result.document.chunkIndex,
      score: result.score,
      distance: result.distance,
      metadata: {
        techStack: result.document.metadata.techStack,
        description: result.document.metadata.description,
        commands: result.document.metadata.commands,
        language: result.document.metadata.language,
        framework: result.document.metadata.framework,
      },
    }));

    return NextResponse.json({
      success: true,
      query,
      totalResults: formattedResults.length,
      results: formattedResults,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      {
        error: 'Failed to search knowledge base',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
