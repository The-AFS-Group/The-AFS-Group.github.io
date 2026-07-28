import React from 'react';
import { GAF_COLORS } from '../constants';

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border"
      style={{
        backgroundColor: `${GAF_COLORS.paleGrey}`,
        color: GAF_COLORS.darkGrey,
        borderColor: GAF_COLORS.coolGrey + "40",
        fontFamily: "'Open Sans', sans-serif",
      }}
    >
      {children}
    </span>
  );
};

export default Tag;