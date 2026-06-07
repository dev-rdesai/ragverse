import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Zap } from 'lucide-react';
import './ChatPanel.css';

function SourceCard({ source }) {
  return (
    <div className="source-card">
      <div className="source-header">
        <FileText size={11} />
        <span className="source-name mono">{source.source}</span>
      </div>
      <p className="source-snippet">{source.content}</p>
    </div>
  );
}

function Message({ msg }) {
  return (
    <div className={`message ${msg.role} ${msg.error ? 'error' : ''}`}>
      <div className="msg-meta">
        <span className="msg-role mono">
          {msg.role === 'user' ? '▶ YOU' : '◈ RAGMIND'}
        </span>
        {msg.streaming && <span className="streaming-badge">STREAMING</span>}
      </div>
      <div className="msg-body">
        {msg.role === 'assistant' ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content || ''}
            </ReactMarkdown>
            {msg.streaming && <span className="cursor" />}
          </div>
        ) : (
          <p>{msg.content}</p>
        )}
      </div>
      {msg.sources?.length > 0 && (
        <div className="sources">
          <div className="sources-label mono"><Zap size={10} /> SOURCES ({msg.sources.length})</div>
          <div className="sources-list">
            {msg.sources.map((s, i) => <SourceCard key={i} source={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">◈</div>
      <h2>Ready to query</h2>
      <p>Upload documents via the sidebar, then ask anything about them.</p>
      <div className="empty-hints">
        {['Summarize the key points', 'What does this document say about…', 'Compare the two approaches'].map(h => (
          <span key={h} className="hint mono">{h}</span>
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel({ messages, isLoading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-panel">
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="messages">
          {messages.map(msg => <Message key={msg.id} msg={msg} />)}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="thinking">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
