/** A trip's visible segment lifetime, shared by its independent reader owners. */
const scopes = new Map<string, { readers: number }>();

export function retainSegmentScope(tripId: string): () => void {
  const scope = scopes.get(tripId) ?? { readers: 0 };
  scopes.set(tripId, scope);
  scope.readers++;
  return () => {
    scope.readers--;
    if (scope.readers === 0 && scopes.get(tripId) === scope) scopes.delete(tripId);
  };
}

/** Capture before starting an operation, including when no page reader exists. */
export function captureSegmentScope(tripId: string): () => boolean {
  const scope = scopes.get(tripId);
  return () => scopes.get(tripId) === scope;
}
