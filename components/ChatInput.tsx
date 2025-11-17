import React, { useState, useRef } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onAudioUpload: (file: File) => void;
  isLoading: boolean;
  isRecording: boolean;
  onToggleRecording: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, onAudioUpload, isLoading, isRecording, onToggleRecording }) => {
  const [inputValue, setInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading && !isRecording) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isDisabled = isLoading || isRecording;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAudioUpload(e.target.files[0]);
    }
    if(e.target) e.target.value = '';
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="audio/*"
        disabled={isDisabled}
      />
      <button
        type="button"
        onClick={handleUploadClick}
        disabled={isDisabled}
        className="hidden sm:flex p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Upload audio for transcription"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isRecording ? "Recording..." : "Type a message..."}
        disabled={isDisabled}
        className="flex-1 min-w-0 rounded-2xl py-3 px-5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 disabled:opacity-50"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={isDisabled || !inputValue.trim()}
        className="p-3 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg"
        style={{
          background: (isDisabled || !inputValue.trim()) ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
        }}
        aria-label="Send message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onToggleRecording}
        disabled={isLoading}
        className={`p-3 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 shadow-lg ${
          isRecording ? 'focus:ring-red-500' : 'focus:ring-blue-500'
        }`}
        style={{
          background: isRecording
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : 'rgba(255, 255, 255, 0.1)'
        }}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>
    </form>
  );
};
