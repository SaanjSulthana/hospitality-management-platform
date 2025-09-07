import * as React from "react";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  className?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative h-2 w-full overflow-hidden rounded-full bg-gray-200 ${className || ''}`}
        {...props}
      >
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-in-out"
          style={{ 
            width: `${Math.min(Math.max(value, 0), 100)}%`,
            transform: 'translateZ(0)' // Force hardware acceleration
          }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";

export { Progress };
