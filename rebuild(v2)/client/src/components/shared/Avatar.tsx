import * as React from 'react';
import { StatusDot } from './Badge';
import { cn } from '@/utils/cn';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'suspended' | string;
  showStatus?: boolean;
  className?: string;
}

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

function getInitials(name: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ src, name, size = 'md', status, showStatus = false, className }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [src]);

  const initials = getInitials(name);
  const sizeClasses = sizeMap[size] || sizeMap.md;

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-full border border-border select-none shrink-0",
          sizeClasses,
          className
        )}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={name}
            onError={() => setImageError(true)}
            className="aspect-square h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary font-semibold">
            {initials}
          </div>
        )}
      </div>
      {showStatus && status && (
        <span className="absolute -bottom-0.5 -right-0.5 z-10">
          <StatusDot
            status={status}
            className={cn(
              "border-card",
              size === 'xl' ? "w-5 h-5 border-[3px]" : size === 'lg' ? "w-4 h-4 border-2" : "w-3 h-3 border-2"
            )}
          />
        </span>
      )}
    </div>
  );
}
