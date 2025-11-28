import React from 'react';
import { TrilingualText as TTextType } from '../types';

interface Props {
  text: TTextType;
  className?: string;
}

const TrilingualText: React.FC<Props> = ({ text, className = "" }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Chinese */}
      <p className="text-lg md:text-xl font-bold text-white tracking-wide border-l-4 border-red-500 pl-3">
        {text.zh}
      </p>
      
      {/* Japanese (with Ruby) */}
      <p 
        className="text-base md:text-lg text-yellow-100/90 font-serif border-l-4 border-yellow-500 pl-3 leading-loose"
        dangerouslySetInnerHTML={{ __html: text.ja }}
      />
      
      {/* English */}
      <p className="text-sm md:text-base text-cyan-300/80 font-mono border-l-4 border-cyan-500 pl-3">
        {text.en}
      </p>
    </div>
  );
};

export default TrilingualText;