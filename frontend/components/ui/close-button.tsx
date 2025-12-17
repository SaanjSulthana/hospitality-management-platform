import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
}

export const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(
    ({ className, ...props }, ref) => {
        return (
            <button
                ref={ref}
                type="button"
                className={cn(
                    "group relative flex items-center justify-center w-[44px] h-[44px] rounded-full transition-transform active:scale-95 touch-manipulation z-50 p-0 shadow-sm hover:shadow-md",
                    className
                )}
                {...props}
            >
                {/* Background Layer with opacity and blur */}
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xl rounded-full border border-white/40 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1)] transition-all group-hover:bg-white/90" />

                {/* Subtle Gradient Overlay */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/60 to-transparent opacity-50" />

                {/* Icon */}
                <X className="relative w-4 h-4 text-[#3C3C43] stroke-[2.5px] opacity-70 transition-all group-hover:opacity-100 group-hover:scale-105" />
            </button>
        );
    }
);
CloseButton.displayName = "CloseButton";
