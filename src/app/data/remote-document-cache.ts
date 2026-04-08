const knownRemoteDocumentIds = new Set<string>();

export function rememberRemoteDocumentId(id: string): void {
  knownRemoteDocumentIds.add(id);
}

export function forgetRemoteDocumentId(id: string): void {
  knownRemoteDocumentIds.delete(id);
}

export function hasRemoteDocumentId(id: string): boolean {
  return knownRemoteDocumentIds.has(id);
}

export function resetRemoteDocumentCache(): void {
  knownRemoteDocumentIds.clear();
}
