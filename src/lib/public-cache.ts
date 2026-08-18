let archiveCountCache = { n: 0, at: 0 };

export function readArchiveCountCache(): { n: number; at: number } {
  return archiveCountCache;
}

export function writeArchiveCountCache(n: number): void {
  archiveCountCache = { n, at: Date.now() };
}

export function invalidateArchiveCountCache(): void {
  archiveCountCache = { n: 0, at: 0 };
}
