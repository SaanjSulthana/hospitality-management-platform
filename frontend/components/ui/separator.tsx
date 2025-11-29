import * as React from "react"

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className = "", orientation = "horizontal", decorative = true, ...props },
    ref
  ) => {
    const baseClasses = "shrink-0 bg-gray-200 dark:bg-gray-700";
    const orientationClasses = orientation === "horizontal" 
      ? "h-[1px] w-full my-4" 
      : "h-full w-[1px] mx-4";
    
    return (
      <div
        ref={ref}
        role={decorative ? "none" : "separator"}
        aria-orientation={orientation}
        className={`${baseClasses} ${orientationClasses} ${className}`.trim()}
        {...props}
      />
    );
  }
)

Separator.displayName = "Separator"

export { Separator }

