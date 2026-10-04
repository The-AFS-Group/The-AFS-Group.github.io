import React from 'react';

/**
 * One-line "Source: X · Y" caption, used under every data section across the
 * dashboards so a reader can tell where a number comes from and how fresh it
 * is without digging into the source doc/sheet. `tone` picks light text for
 * dark panels (the OPSP hero, Critical Numbers) vs. the default gray-on-white.
 */
export const SourceNote: React.FC<{ text: string; tone?: 'light' | 'dark'; className?: string }> = ({
    text, tone = 'dark', className = '',
}) => (
    <p className={`text-[10px] font-medium ${tone === 'light' ? 'text-white/40' : 'text-gray-400'} ${className}`}>
        {text}
    </p>
);
