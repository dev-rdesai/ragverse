import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';
import './InputBar.css';

export default function InputBar({ onSend, onClear, isLoading, hasMessages }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [value]);

  const handleSubmit = () => {
    const q = value.trim();
    if (!q || isLoading) return;
    onSend(q);
    setValue('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="input-bar">
      <div className="input-inner">
        <textarea
          ref={textareaRef}
          className="input-area mono"
          placeholder="Ask anything about your documents…"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={isLoading}
        />
        <div className="input-actions">
          {hasMessages && (
            <button className="btn-clear" onClick={onClear} title="Clear chat" disabled={isLoading}>
              <Trash2 size={14} />
            </button>
          )}
          <button
            className={`btn-send ${isLoading ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={!value.trim() || isLoading}
            title="Send (Enter)"
          >
            {isLoading
              ? <span className="send-spinner" />
              : <Send size={15} />
            }
          </button>
        </div>
      </div>
      <div className="input-hint mono">ENTER to send · SHIFT+ENTER for newline</div>
    </div>
  );
}
