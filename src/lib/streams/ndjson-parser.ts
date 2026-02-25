export interface NDJSONCallbacks<T = Record<string, unknown>> {
  onMeta?: (meta: Record<string, unknown>) => void;
  onRow?: (row: T) => void;
  onBatch?: (rows: T[]) => void;
  onError?: (error: string) => void;
}

/**
 * Parse an NDJSON ReadableStream, dispatching typed callbacks for
 * meta frames, data rows (batched per chunk), and error frames.
 *
 * Supports AbortSignal for cancellation.
 */
export async function parseNDJSONStream<T = Record<string, unknown>>(
  body: ReadableStream<Uint8Array>,
  callbacks: NDJSONCallbacks<T>,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      const batch: T[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);

          if (json.meta) {
            callbacks.onMeta?.(json.meta);
            continue;
          }

          if (json.error) {
            callbacks.onError?.(json.error);
            continue;
          }

          batch.push(json as T);
          callbacks.onRow?.(json as T);
        } catch {
          // skip malformed lines
        }
      }

      if (batch.length > 0) {
        callbacks.onBatch?.(batch);
      }
    }

    // flush any remaining buffer
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer);
        if (json.meta) {
          callbacks.onMeta?.(json.meta);
        } else if (json.error) {
          callbacks.onError?.(json.error);
        } else {
          callbacks.onRow?.(json as T);
          callbacks.onBatch?.([json as T]);
        }
      } catch {
        // skip malformed trailing data
      }
    }
  } finally {
    reader.releaseLock();
  }
}
