import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  caption: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, imageUrl, caption }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="relative max-w-5xl w-full flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 text-gray-400 hover:text-white transition-colors flex items-center gap-2 border border-gray-700 px-3 py-1 rounded bg-black/50 hover:bg-gray-800"
        >
          <X size={20} /> ЗАКРЫТЬ
        </button>
        
        <div className="border border-[#00bcd4] shadow-[0_0_50px_rgba(0,188,212,0.2)] bg-black p-1 rounded-sm w-full h-full flex justify-center items-center overflow-hidden">
            <img 
              src={imageUrl} 
              alt={caption} 
              referrerPolicy="no-referrer"
              className="max-h-[80vh] max-w-full object-contain"
            />
        </div>
        
        <div className="mt-4 text-[#00bcd4] font-mono text-sm md:text-lg text-center bg-black/60 px-6 py-2 rounded border-b-2 border-[#00bcd4]">
          {caption}
        </div>
      </div>
    </div>
  );
};