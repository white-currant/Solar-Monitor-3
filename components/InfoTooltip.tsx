import React from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  description: React.ReactNode;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, description }) => {
  return (
    <div className="relative group inline-block ml-2 z-[9999]">
      <div className="cursor-help text-cyan-400 hover:text-white transition-colors p-1">
        <Info size={16} />
      </div>
      
      {/* 
          Positioning:
          top-full + mt-2: Push down below the icon
          right-0: Align right edge with the icon (extends to left)
          z-[9999]: Ensure it floats above everything else
      */}
      <div className="absolute top-full mt-2 right-0 w-80 bg-[#151a25] border border-[#00bcd4] text-gray-200 p-5 rounded shadow-[0_0_30px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[9999]">
        <h4 className="text-[#00bcd4] font-bold mb-3 uppercase tracking-wider text-sm">
          {title}
        </h4>
        <div className="font-mono text-sm leading-relaxed text-gray-300">
          {description}
        </div>
        
        {/* Arrow pointing up (positioned at the right to match icon) */}
        <div className="absolute right-2 -top-[6px] w-3 h-3 bg-[#151a25] border-l border-t border-[#00bcd4] transform rotate-45"></div>
      </div>
    </div>
  );
};