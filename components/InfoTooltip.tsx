import React from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  description: React.ReactNode;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, description }) => {
  return (
    <div className="relative group inline-block ml-2 z-[10000]">
      <div className="cursor-help text-cyan-400 hover:text-white transition-colors p-1">
        <Info size={16} />
      </div>
      
      {/* 
          Positioning Update:
          top-full: Puts it below the icon.
          right-0: Aligns right edge to icon right edge (avoids overflowing right screen).
          mt-2: Small gap.
          max-w-[90vw]: Ensures it doesn't exceed screen width on mobile.
          w-72: Standard width.
      */}
      <div className="absolute top-full right-0 mt-2 w-72 max-w-[90vw] bg-[#151a25] border border-[#00bcd4] text-gray-200 p-5 rounded shadow-[0_0_30px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[99999]">
        <h4 className="text-[#00bcd4] font-bold mb-3 uppercase tracking-wider text-sm">
          {title}
        </h4>
        <div className="font-mono text-sm leading-relaxed text-gray-300">
          {description}
        </div>
      </div>
    </div>
  );
};
