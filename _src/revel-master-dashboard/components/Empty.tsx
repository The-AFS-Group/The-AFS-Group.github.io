import React from 'react';
import { Loader2 } from 'lucide-react';

const Empty: React.FC<{ loading: boolean }> = ({ loading }) => {
  return (
    <div className="w-full h-48 grid place-items-center text-gray-500">
      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" /> Loading
        </div>
      ) : (
        "No data"
      )}
    </div>
  );
};

export default Empty;