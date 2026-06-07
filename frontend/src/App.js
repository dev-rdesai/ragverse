import React from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import InputBar from './components/InputBar';
import { useRAG } from './hooks/useRAG';
import './App.css';

export default function App() {
  const {
    messages, isLoading, stats, backendOnline,
    uploadState, sendMessage, uploadFile,
    clearMessages, resetCollection, refreshStats,
  } = useRAG();

  return (
    <div className="app">
      <Sidebar
        stats={stats}
        uploadState={uploadState}
        backendOnline={backendOnline}
        onUpload={uploadFile}
        onReset={resetCollection}
        onRefreshStats={refreshStats}
      />
      <div className="main">
        <ChatPanel messages={messages} isLoading={isLoading} />
        <InputBar
          onSend={sendMessage}
          onClear={clearMessages}
          isLoading={isLoading}
          hasMessages={messages.length > 0}
        />
      </div>
    </div>
  );
}
