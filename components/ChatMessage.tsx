import React from 'react';
import type { Message } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

const UserIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const NexusIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        <defs>
            <linearGradient id="nexusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
        </defs>
    </svg>
);

const renderMarkdown = (text: string): React.ReactNode[] => {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g; // Link or Bold
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        if (match[1] && match[2]) {
            parts.push(
                <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    {match[1]}
                </a>
            );
        } else if (match[3]) {
            parts.push(<strong key={match.index}>{match[3]}</strong>);
        }
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>);
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLoading }) => {
  const isUser = message.role === 'user';

  const containerClasses = isUser ? 'flex justify-end items-start space-x-1.5 sm:space-x-2 md:space-x-3' : 'flex justify-start items-start space-x-1.5 sm:space-x-2 md:space-x-3';
  const bubbleClasses = isUser
    ? 'rounded-2xl p-3 sm:p-4 shadow-lg max-w-[80%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-lg'
    : 'rounded-2xl p-3 sm:p-4 shadow-lg min-h-[40px] flex items-center max-w-[80%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-lg';

  const iconContainerClasses = `w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-2xl flex items-center justify-center shadow-lg ${isUser ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-br from-blue-500 via-cyan-400 to-blue-600'}`;

  const UserMessage = () => (
    <>
      <div className={bubbleClasses} style={{
        background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
      }}>
        <p className="text-sm sm:text-base text-white whitespace-pre-wrap break-words font-medium">{message.text}</p>
      </div>
      <div className={iconContainerClasses}>
        <UserIcon />
      </div>
    </>
  );

  const ModelMessage = () => (
    <>
      <div className={iconContainerClasses}>
        <NexusIcon />
      </div>
      <div className={bubbleClasses} style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {isLoading && !message.text ? (
          <div className="w-5 h-5 sm:w-6 sm:h-6">
            <LoadingSpinner />
          </div>
        ) : (
          <p className="text-sm sm:text-base text-gray-200 whitespace-pre-wrap break-words min-w-0">
            {renderMarkdown(message.text)}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className={containerClasses}>
      {isUser ? <UserMessage /> : <ModelMessage />}
    </div>
  );
};
