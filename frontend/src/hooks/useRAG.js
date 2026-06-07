import { useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';

export function useRAG() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);
  const [uploadState, setUploadState] = useState({ status: 'idle', message: '' });

  const checkHealth = useCallback(async () => {
    try {
      await api.health();
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const s = await api.stats();
      setStats(s);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    checkHealth();
    refreshStats();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth, refreshStats]);

  const uploadFile = useCallback(async (file) => {
    setUploadState({ status: 'uploading', message: `Ingesting "${file.name}"…` });
    try {
      const result = await api.upload(file);
      setUploadState({
        status: 'success',
        message: `✓ "${result.filename}" — ${result.chunks_stored} chunks stored`,
      });
      await refreshStats();
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 4000);
    } catch (e) {
      setUploadState({ status: 'error', message: e.message });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 5000);
    }
  }, [refreshStats]);

  const sendMessage = useCallback(async (question) => {
    if (!question.trim() || isLoading) return;

    const userMsg = { id: Date.now(), role: 'user', content: question };
    const botId = Date.now() + 1;
    const botMsg = { id: botId, role: 'assistant', content: '', sources: [], streaming: true };

    setMessages(prev => [...prev, userMsg, botMsg]);
    setIsLoading(true);

    try {
      let accumulated = '';
      for await (const token of api.queryStream(question)) {
        accumulated += token;
        setMessages(prev =>
          prev.map(m => m.id === botId ? { ...m, content: accumulated } : m)
        );
      }
      // Fetch sources via non-streaming query (lightweight)
      const full = await api.query(question);
      setMessages(prev =>
        prev.map(m =>
          m.id === botId
            ? { ...m, content: full.answer, sources: full.sources, streaming: false }
            : m
        )
      );
    } catch (e) {
      setMessages(prev =>
        prev.map(m =>
          m.id === botId
            ? { ...m, content: `Error: ${e.message}`, streaming: false, error: true }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearMessages = useCallback(() => setMessages([]), []);

  const resetCollection = useCallback(async () => {
    try {
      await api.reset();
      await refreshStats();
      return true;
    } catch {
      return false;
    }
  }, [refreshStats]);

  return {
    messages, isLoading, stats, backendOnline,
    uploadState, sendMessage, uploadFile,
    clearMessages, resetCollection, refreshStats,
  };
}
