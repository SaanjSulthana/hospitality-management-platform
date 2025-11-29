import React from 'react';

export function ScrollArea({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`overflow-auto ${className}`}>{children}</div>;
}

export default ScrollArea;


