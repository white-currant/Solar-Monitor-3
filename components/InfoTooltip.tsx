import React, { useRef, useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  description: React.ReactNode;
  source?: string;
  lastUpdate?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  title, 
  description, 
  source,
  lastUpdate
}) => {
  const [alignClass, setAlignClass] = useState('left-0');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const windowWidth = window.innerWidth;
          
          // Smart positioning:
          // If the icon is in the right half of the screen, align the tooltip to the right (expanding left).
          // Otherwise align to the left (expanding right).
          // This keeps the tooltip inside the viewport.
          if (rect.left > windowWidth / 2) {
              setAlignClass('right-0');
          } else {
              setAlignClass('left-0');
          }
      }
  };

  return (
    <div 
        ref={containerRef} 
        className="relative group inline-block ml-2 z-[10000]"
        onMouseEnter={handleMouseEnter}
    >
      <div className="cursor-help text-cyan-400 hover:text-white transition-colors p-1">
        <Info size={16} />
      </div>
      
      <div className={`absolute top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-[#151a25] border border-[#00bcd4] text-gray-200 p-4 rounded shadow-[0_0_40px_rgba(0,0,0,0.95)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[99999] ${alignClass}`}>
        
        {/* Title */}
        <h4 className="text-[#00bcd4] font-bold mb-2 uppercase tracking-wider text-sm border-b border-[#00bcd4]/30 pb-2">
          {title}
        </h4>
        
        {/* Content */}
        <div className="font-mono text-xs md:text-sm leading-relaxed text-gray-300">
          {description}
        </div>

        {/* Data Source Footer */}
        {(source || lastUpdate) && (
            <div className="mt-3 pt-2 border-t border-dashed border-gray-700 text-[10px] font-mono text-gray-500 flex flex-col gap-1">
                {source && (
                    <div className="flex justify-between">
                        <span>ИСТОЧНИК:</span>
                        <span className="text-gray-400 uppercase">{source}</span>
                    </div>
                )}
                {lastUpdate && (
                    <div className="flex justify-between">
                        <span>ОБНОВЛЕНО:</span>
                        <span className="text-[#00e676]">{lastUpdate}</span>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
