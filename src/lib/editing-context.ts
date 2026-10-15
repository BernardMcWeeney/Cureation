import { AsyncLocalStorage } from 'node:async_hooks';

/** Request-local state: never share preview data between Worker requests. */
export const editingContext = new AsyncLocalStorage<{ preview: boolean; bypassCache?: boolean; privateData?: boolean; dataFailures?: Set<string>; copy: Record<string, string>; playCounts?: Promise<Map<number, number>> }>();
