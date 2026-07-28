import React from 'react';
import { Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';

// Simplified ChartContainer mimicking Shadcn UI pattern for this specific dashboard
export const ChartContainer = ({ children, config, className }: any) => {
  return (
    <div className={cn("w-full", className)}>
      <style>
        {Object.entries(config || {}).map(([key, value]: any) => `
          :root {
            --color-${key}: ${value.color};
          }
        `).join('\n')}
      </style>
      {children}
    </div>
  );
};

// Wrapper for Recharts Tooltip to inject props into custom content
export const ChartTooltip = (props: any) => {
  const { content, ...rest } = props;
  
  if (React.isValidElement(content)) {
     return <Tooltip {...rest} cursor={{fill: 'rgba(0,0,0,0.05)'}} content={(tooltipProps) => {
         return React.cloneElement(content as React.ReactElement, {
             ...(tooltipProps as any),
             formatter: props.formatter,
             labelFormatter: props.labelFormatter,
             // Merge existing props from the content element
             ...(content.props as any)
         })
     }} />
  }
  return <Tooltip {...rest} />;
}

export const ChartTooltipContent = ({ active, payload, label, className, formatter, labelFormatter }: any) => {
    if (!active || !payload || !payload.length) return null;

    const finalLabel = labelFormatter ? labelFormatter(label, payload) : label;

    return (
        <div className={cn("rounded-lg border bg-background p-2 shadow-sm", className)}>
            <div className="font-bold mb-1 text-sm">{finalLabel}</div>
            <div className="flex flex-col gap-1">
                {payload.map((item: any, index: number) => {
                     const formatted = formatter ? formatter(item.value, item.name, item) : [item.value, item.name];
                     return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.fill || item.color}} />
                            <span className="capitalize opacity-70">{formatted[1]}:</span>
                            <span className="font-mono font-medium">{formatted[0]}</span>
                        </div>
                     )
                })}
            </div>
        </div>
    )
};

export { ChartTooltipContent as ChartTooltipContentComponent }; // Export alias if needed