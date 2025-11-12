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
    // Reset file input to allow uploading the same file again
    if(e.target) e.target.value = '';
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const audioButtonClasses = `
    text-white rounded-full p-2 sm:p-3 transition duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
    ${isRecording
      ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500'
      : 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-500'
    }
    disabled:bg-gray-600 disabled:cursor-not-allowed
  `;

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2 sm:gap-3">
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
        className="bg-gray-700 text-white rounded-full p-2 sm:p-3 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500"
        aria-label="Upload audio for transcription"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isRecording ? "Conversa por voz ativa..." : "Mensagem para J.A.R.V.I.S...."}
        disabled={isDisabled}
        className="flex-1 min-w-0 bg-gray-800 border-2 border-gray-700 rounded-full py-2 sm:py-3 px-3 sm:px-6 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 disabled:opacity-50"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={isDisabled || !inputValue.trim()}
        className="bg-gray-700 text-white rounded-full p-2 sm:p-3 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500"
        aria-label="Send message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>
       <button
        type="button"
        onClick={onToggleRecording}
        disabled={isLoading}
        className={audioButtonClasses}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 sm:h-6 sm:w-6 ${isRecording ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>
    </form>
  );
};