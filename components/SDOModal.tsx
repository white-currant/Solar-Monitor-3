
import React, { useState, useEffect } from 'react';
import { X, RefreshCw, ExternalLink } from 'lucide-react';

interface SDOModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANNELS = [
    {
        id: '193',
        label: 'AIA 193Å',
        color: 'border-[#a1887f]', // Bronze
        desc: 'Корональные дыры. Источник ветра.',
        url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0193.jpg'
    },
    {
        id: '304',
        label: 'AIA 304Å',
        color: 'border-[#ef5350]', // Red
        desc: 'Протуберанцы и нити (Хромосфера).',
        url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0304.jpg'
    },
    {
        id: '131',
        label: 'AIA 131Å',
        color: 'border-[#26c6da]', // Teal
        desc: 'Вспышки (Экстремально горячая плазма).',
        url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0131.jpg'
    },
    {
        id: 'HMII',
        label: 'HMI SPOTS',
        color: 'border-[#ffca28]', // Orange
        desc: 'Пятна на поверхности (Видимый свет).',
        url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_HMII.jpg'
    }
];

export const SDOModal: React.FC<SDOModalProps> = ({ isOpen, onClose }) => {
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
  const [loading, setLoading] = useState(true);
  const [timestamp, setTimestamp] = useState(Date.now());

  useEffect(() => {
      if (isOpen) {
          setTimestamp(Date.now()); // Force fresh image on open
          setLoading(true);
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImageLoad = () => {
      setLoading(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl w-full bg-[#10141e] border border-white/10 rounded-lg flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,188,212,0.1)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/40">
            <div>
                <h3 className="text-[#00bcd4] font-bold tracking-widest uppercase flex items-center gap-2">
                    NASA SDO / AIA
                    <span className="text-[10px] px-1.5 py-0.5 border border-white/20 rounded text-gray-400">LIVE FEED</span>
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-1">Solar Dynamics Observatory (Near-Realtime)</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 overflow-x-auto">
            {CHANNELS.map((ch) => (
                <button
                    key={ch.id}
                    onClick={() => {
                        if (activeChannel.id !== ch.id) {
                            setActiveChannel(ch);
                            setLoading(true);
                        }
                    }}
                    className={`flex-1 py-3 px-2 text-xs md:text-sm font-bold tracking-wider transition-all border-b-2 whitespace-nowrap ${
                        activeChannel.id === ch.id 
                        ? `${ch.color} bg-white/5 text-white` 
                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                >
                    {ch.label}
                </button>
            ))}
        </div>

        {/* Content */}
        <div className="relative p-1 bg-black min-h-[300px] md:min-h-[500px] flex items-center justify-center">
            
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
                    <RefreshCw className="animate-spin text-[#00bcd4]" size={32} />
                </div>
            )}

            <img 
                key={`${activeChannel.id}-${timestamp}`} // Force re-render logic
                src={`${activeChannel.url}?t=${timestamp}`}
                alt={activeChannel.label}
                onLoad={handleImageLoad}
                className={`max-h-[60vh] max-w-full object-contain transition-opacity duration-500 ${loading ? 'opacity-50' : 'opacity-100'}`}
            />
            
            {/* Footer Legend */}
            <div className="absolute bottom-4 left-0 w-full text-center pointer-events-none">
                <span className="bg-black/70 text-gray-200 px-3 py-1 rounded text-xs font-mono border border-white/10 shadow-lg backdrop-blur-md">
                    {activeChannel.desc}
                </span>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-black/40 border-t border-white/10 flex justify-between items-center">
            <a 
                href="https://sdo.gsfc.nasa.gov/data/" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-gray-500 hover:text-[#00bcd4] flex items-center gap-1"
            >
                <ExternalLink size={12} /> Официальный сайт NASA SDO
            </a>
            
            <button 
                onClick={() => {
                    setLoading(true);
                    setTimestamp(Date.now()); // Update timestamp to fetch fresh image
                }}
                className="text-xs text-[#00bcd4] hover:text-white border border-[#00bcd4]/30 hover:bg-[#00bcd4]/20 px-3 py-1 rounded flex items-center gap-1 transition-all"
            >
                <RefreshCw size={12} /> ОБНОВИТЬ СНИМОК
            </button>
        </div>
      </div>
    </div>
  );
};
