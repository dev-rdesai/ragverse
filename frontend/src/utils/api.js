const BASE = '';  // uses CRA proxy to localhost:8000

export const api = {
  async health() {
    const r = await fetch(`${BASE}/health`);
    return r.json();
  },

  async upload(file, onProgress) {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || 'Upload failed');
    }
    return r.json();
  },

  async query(question, topK = 4) {
    const r = await fetch(`${BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, top_k: topK }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || 'Query failed');
    }
    return r.json();
  },

  async *queryStream(question, topK = 4) {
    const r = await fetch(`${BASE}/query/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, top_k: topK }),
    });
    if (!r.ok) throw new Error('Stream failed');

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const token = line.slice(6);
          if (token === '[DONE]') return;
          if (token.startsWith('[ERROR]')) throw new Error(token.slice(8));
          yield token;
        }
      }
    }
  },

  async stats() {
    const r = await fetch(`${BASE}/collections/stats`);
    if (!r.ok) throw new Error('Stats fetch failed');
    return r.json();
  },

  async reset() {
    const r = await fetch(`${BASE}/collections/reset`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Reset failed');
    return r.json();
  },
};
