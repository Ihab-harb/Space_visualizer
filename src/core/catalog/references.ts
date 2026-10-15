export function collectSourceIds(value: unknown, path: string[] = []): Array<{ path: string; sourceId: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectSourceIds(item, [...path, String(i)]));
  }
  if (value !== null && typeof value === 'object') {
    const found: Array<{ path: string; sourceId: string }> = [];
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'sourceId' || key.endsWith('SourceId')) && typeof child === 'string') found.push({ path: [...path, key].join('.'), sourceId: child });
      else found.push(...collectSourceIds(child, [...path, key]));
    }
    return found;
  }
  return [];
}

export function findUnresolvedSources(value: unknown, known: ReadonlySet<string>): string[] {
  return collectSourceIds(value)
    .filter((ref) => !known.has(ref.sourceId))
    .map((ref) => `${ref.path}: unknown sourceId "${ref.sourceId}"`);
}

export function formatIssues(
  prefix: string,
  error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> },
): string[] {
  return error.issues.map((issue) => `${prefix}: ${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`);
}
