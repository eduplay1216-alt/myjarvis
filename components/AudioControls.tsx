import React from 'react';

interface AudioControlsProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  isLoading: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({ isRecording, onToggleRecording, isLoading }) => {
  const buttonClasses = `
    text-white rounded-full p-3 transition duration-200 
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 
    ${isRecording 
      ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500' 
      : 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-500'
    }
    disabled:bg-gray-600 disabled:cursor-not-allowed
  `;

  return (
    <button
      type="button"
      onClick={onToggleRecording}
      disabled={isLoading}
      className={buttonClasses}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isRecording ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </button>
  );
};
