import React from 'react';

interface Props {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}

const StatBar: React.FC<Props> = ({ label, value, color, icon }) => {
  // Clamp value
  const displayValue = Math.min(100, Math.max(0, value));
  
  return (
    <div className="flex items-center gap-3 w-full font-mono text-sm">
      <div className={`p-2 rounded bg-slate-800 text-${color}-400`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className={`text-${color}-400 font-bold uppercase tracking-wider`}>{label}</span>
          <span className="text-slate-400">{displayValue}%</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-${color}-500 transition-all duration-1000 ease-out`}
            style={{ width: `${displayValue}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default StatBar;