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

  async anonymize(text: string, token?: string | null) {
    const res = await fetch(`${API_URL}/api/anonymize`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
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

export const apiClient = new ApiClient();
