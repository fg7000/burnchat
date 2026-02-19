const API_URL = "";

class ApiClient {
  private getHeaders(token?: string | null): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async anonymize(
    text: string,
    token?: string | null,
    existingMapping?: { original: string; replacement: string; entity_type: string }[]
  ) {
    const payload: Record<string, unknown> = { text };
    if (existingMapping && existingMapping.length > 0) {
      payload.existing_mapping = existingMapping;
    }
    const res = await fetch(`${API_URL}/api/anonymize`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  /**
   * Anonymize large text by splitting into chunks and processing each
   * sequentially. Each chunk sends the accumulated mapping from previous
   * chunks so entity replacements stay consistent.
   */
  async anonymizeChunked(
    text: string,
    token?: string | null,
    onProgress?: (pct: number, detail?: string) => void
  ) {
    const CHUNK_SIZE = 30_000;
    const chunks = splitTextIntoChunks(text, CHUNK_SIZE);

    if (chunks.length <= 1) {
      // Small enough for a single call
      return this.anonymize(text, token);
    }

    let allAnonymized = "";
    let allMapping: { original: string; replacement: string; entity_type: string }[] = [];
    const entityCounts: Record<string, number> = {};

    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(
        Math.round(((i) / chunks.length) * 100),
        `Anonymizing part ${i + 1} of ${chunks.length}...`
      );

      const result = await this.anonymize(chunks[i], token, allMapping);

      allAnonymized += result.anonymized_text;

      // Accumulate mapping (deduplicate by original+entity_type)
      const seen = new Set(allMapping.map((m: { entity_type: string; original: string }) => `${m.entity_type}:${m.original}`));
      for (const entry of result.mapping) {
        const key = `${entry.entity_type}:${entry.original}`;
        if (!seen.has(key)) {
          seen.add(key);
          allMapping.push(entry);
        }
      }

      // Accumulate entity counts
      for (const entity of result.entities_found) {
        entityCounts[entity.type] = (entityCounts[entity.type] || 0) + entity.count;
      }
    }

    onProgress?.(100, "Anonymization complete");

    return {
      anonymized_text: allAnonymized,
      mapping: allMapping,
      entities_found: Object.entries(entityCounts).map(([type, count]) => ({ type, count })),
    };
  }

  async ingestUrl(url: string, token?: string | null) {
    const res = await fetch(`${API_URL}/api/ingest-url`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async ingestGDriveFolder(folderUrl: string, token?: string | null) {
    const res = await fetch(`${API_URL}/api/ingest-gdrive-folder`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ folder_url: folderUrl }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async processDocuments(
    documents: { filename: string; text: string }[],
    sessionId?: string | null,
    token?: string | null
  ) {
    const res = await fetch(`${API_URL}/api/documents/process`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ documents, session_id: sessionId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async searchDocuments(sessionId: string, query: string, topK: number = 10, token?: string | null) {
    const res = await fetch(`${API_URL}/api/documents/search`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ session_id: sessionId, query, top_k: topK }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  chatStream(
    model: string | null,
    messages: { role: string; content: string }[],
    options: {
      sessionId?: string | null;
      anonymizedDocument?: string | null;
      token?: string | null;
    }
  ) {
    const url = `${API_URL}/api/chat`;
    const body = JSON.stringify({
      model,
      messages,
      session_id: options.sessionId,
      anonymized_document: options.anonymizedDocument,
      session_token: options.token,
    });

    return this._createSSEReader(url, body, options.token);
  }

  _createSSEReader(url: string, body: string, token?: string | null) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();

    const readerPromise = fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    }).then((res) => {
      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
      return res.body!.getReader();
    });

    return { readerPromise, abort: () => controller.abort() };
  }

  async getModels(token?: string | null) {
    const res = await fetch(`${API_URL}/api/models`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async recommendModel(tokenCount: number, entityCount: number, query: string, token?: string | null) {
    const res = await fetch(`${API_URL}/api/recommend-model`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ token_count: tokenCount, entity_count: entityCount, query }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getMe(token: string) {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  getGoogleAuthUrl() {
    return `${API_URL}/api/auth/google`;
  }

  async getCreditBalance(token: string) {
    const res = await fetch(`${API_URL}/api/credits/balance`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getCreditHistory(token: string) {
    const res = await fetch(`${API_URL}/api/credits/history`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async purchaseCredits(packageId: string, token: string) {
    const res = await fetch(`${API_URL}/api/credits/purchase`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ package_id: packageId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // Sessions
  async createSession(name: string, mappingEncrypted: string, token: string) {
    const res = await fetch(`${API_URL}/api/sessions/create`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ name, mapping_encrypted: mappingEncrypted }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async saveSessionMapping(sessionId: string, mappingEncrypted: string, token: string) {
    const res = await fetch(`${API_URL}/api/sessions/save-mapping`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ session_id: sessionId, mapping_encrypted: mappingEncrypted }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async listSessions(token: string) {
    const res = await fetch(`${API_URL}/api/sessions/list`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getSession(sessionId: string, token: string) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async deleteSession(sessionId: string, token: string) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
      method: "DELETE",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

/**
 * Split text into chunks at paragraph boundaries ("\n\n"), keeping each
 * chunk under `maxChars`.  Falls back to hard splits if a single paragraph
 * exceeds the limit.
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) chunks.push(current);

      // If a single paragraph exceeds maxChars, split it at maxChars
      if (para.length > maxChars) {
        let remaining = para;
        while (remaining.length > maxChars) {
          chunks.push(remaining.slice(0, maxChars));
          remaining = remaining.slice(maxChars);
        }
        current = remaining;
      } else {
        current = para;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export const apiClient = new ApiClient();
