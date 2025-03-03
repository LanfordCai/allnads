'use client';

import { FC, useEffect } from 'react';

interface NotificationProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
}

const Notification: FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700'
  }[type];

  // 在组件内部处理截断逻辑
  const truncateMessage = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };

  return (
    <div className={`fixed top-[72px] right-4 z-50 px-4 py-3 rounded border ${bgColor} flex items-center shadow-lg max-w-xs`}>
      <span className="mr-2 truncate" title={message}>{truncateMessage(message)}</span>
      <button
        onClick={onClose}
        className="ml-auto text-sm opacity-75 hover:opacity-100 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
};

export default Notification; 