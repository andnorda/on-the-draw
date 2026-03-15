export interface FetchResult<T> {
  data: T | null;
  error: string | null;
}

export async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  timeoutMs = 10_000,
): Promise<FetchResult<T>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      console.warn(`[fetch] HTTP ${response.status} from ${url}`);
      return { data: null, error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[fetch] Failed: ${url} — ${message}`);
    return { data: null, error: message };
  }
}

export async function safeTextFetch(
  url: string,
  options?: RequestInit,
  timeoutMs = 10_000,
): Promise<FetchResult<string>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      console.warn(`[fetch] HTTP ${response.status} from ${url}`);
      return { data: null, error: `HTTP ${response.status}` };
    }
    const text = await response.text();
    return { data: text, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[fetch] Failed: ${url} — ${message}`);
    return { data: null, error: message };
  }
}
