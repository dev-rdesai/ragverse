import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Database, Upload, Trash2, RefreshCw, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({ stats, uploadState, backendOnline, onUpload, onReset, onRefreshStats }) {
  const [confirmReset, setConfirmReset] = useState(false);

  const onDrop = useCallback((files) => {
    if (files[0]) onUpload(files[0]);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'application/pdf': ['.pdf'], 'text/markdown': ['.md'] },
    multiple: false,
    disabled: uploadState.status === 'uploading',
  });

  const handleReset = async () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return; }
    await onReset();
    setConfirmReset(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">RAG<span className="logo-accent">VERSE</span></span>
        </div>
        <div className={`status-badge ${backendOnline === null ? 'unknown' : backendOnline ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {backendOnline === null ? 'CHECKING' : backendOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-label">KNOWLEDGE BASE</div>
        <div className="stats-grid">
          <div className="stat-block">
            <div className="stat-value mono">{stats?.vectors_count ?? '—'}</div>
            <div className="stat-label">VECTORS</div>
          </div>
          <div className="stat-block">
            <div className="stat-value mono">{stats?.points_count ?? '—'}</div>
            <div className="stat-label">CHUNKS</div>
          </div>
        </div>
        {stats && (
          <div className="collection-info mono">
            <Database size={11} /> {stats.collection}
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="section-label">INGEST DOCUMENT</div>
        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? 'active' : ''} ${uploadState.status === 'uploading' ? 'loading' : ''}`}
        >
          <input {...getInputProps()} />
          <Upload size={20} className="drop-icon" />
          {isDragActive
            ? <span>Drop it here</span>
            : <span>Drop file or <u>browse</u></span>
          }
          <span className="drop-types">TXT · PDF · MD</span>
        </div>

        {uploadState.message && (
          <div className={`upload-status ${uploadState.status}`}>
            {uploadState.status === 'success' && <CheckCircle size={13} />}
            {uploadState.status === 'error' && <AlertCircle size={13} />}
            {uploadState.status === 'uploading' && <RefreshCw size={13} className="spin" />}
            <span className="mono">{uploadState.message}</span>
          </div>
        )}
      </div>

      <div className="sidebar-section stack-info">
        <div className="section-label">STACK</div>
        {[
          ['LLM', 'Llama 3.1 (Ollama)'],
          ['EMBED', 'BGE-base-en-v1.5'],
          ['STORE', 'Qdrant'],
          ['CHAIN', 'LangChain'],
          ['API',   'FastAPI'],
        ].map(([k, v]) => (
          <div className="stack-row" key={k}>
            <span className="stack-key mono">{k}</span>
            <span className="stack-val">{v}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="btn-icon" onClick={onRefreshStats} title="Refresh stats">
          <RefreshCw size={14} />
        </button>
        <button
          className={`btn-danger ${confirmReset ? 'confirm' : ''}`}
          onClick={handleReset}
          title="Reset collection"
        >
          <Trash2 size={14} />
          {confirmReset ? 'CONFIRM RESET?' : 'RESET DB'}
        </button>
      </div>
    </aside>
  );
}
