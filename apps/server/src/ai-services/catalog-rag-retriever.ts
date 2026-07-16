import type { RetrievedModule } from '@homecraft/contracts';

export type RetrieveOptions = {
  topK?: number;
  catalogId?: string;
};

/**
 * Retrieves catalog modules relevant to a query via RAG.
 * Step0: returns empty list; indexer wired in phase 1.
 */
export async function retrieve(
  query: string,
  catalogId: string,
  k = 5,
  _options: RetrieveOptions = {}
): Promise<RetrievedModule[]> {
  void query;
  void catalogId;
  void k;
  return [];
}
