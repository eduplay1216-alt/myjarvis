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

const JarvisIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
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
    ? 'bg-blue-600 rounded-lg p-1.5 sm:p-2 md:p-3 shadow-md max-w-[80%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-lg'
    : 'bg-gray-800 rounded-lg p-1.5 sm:p-2 md:p-3 shadow-md min-h-[40px] flex items-center max-w-[80%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-lg';

  const iconContainerClasses = `w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 flex-shrink-0 rounded-full flex items-center justify-center border-2 ${isUser ? 'bg-gray-700 border-gray-500' : 'bg-blue-500/20 border-blue-400'}`;

  const UserMessage = () => (
    <>
      <div className={bubbleClasses}>
        <p className="text-xs sm:text-sm md:text-base text-white whitespace-pre-wrap break-words">{message.text}</p>
      </div>
      <div className={iconContainerClasses}>
        <UserIcon />
      </div>
    </>
  );

  const ModelMessage = () => (
    <>
      <div className={iconContainerClasses}>
        <JarvisIcon />
      </div>
      <div className={bubbleClasses}>
        {isLoading && !message.text ? (
          <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6">
            <LoadingSpinner />
          </div>
        ) : (
          <p className="text-xs sm:text-sm md:text-base text-gray-200 whitespace-pre-wrap break-words min-w-0">
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
