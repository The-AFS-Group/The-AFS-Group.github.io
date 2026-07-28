import React from 'react';
import { Loader2 } from 'lucide-react';

export const UpdatingBadge: React.FC<{ isUpdating: boolean; className?: string }> = ({ isUpdating, className }) => {
  if (!isUpdating) return null;
  return (
    <div className={`absolute flex items-center gap-1.5 px-2.5 py-1 bg-white/80 backdrop-blur-md border border-gray-200 rounded-full shadow-sm z-10 ${className || 'top-4 left-1/2 -translate-x-1/2'}`}>
      <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
      <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">Updating</span>
    </div>
  );
};
