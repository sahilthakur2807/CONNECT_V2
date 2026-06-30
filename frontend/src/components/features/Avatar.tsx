import { StatusDot } from './Badge';
import type { UserStatus } from '@/types';
import { cn } from '@/utils/cn';
import { Avatar as BaseAvatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: UserStatus;
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
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ src, name, size = 'md', status, showStatus = false, className }: AvatarProps) {
  return (
    <div className="relative inline-flex shrink-0">
      <BaseAvatar className={cn(sizeMap[size], 'border border-border', className)}>
        <AvatarImage src={src} alt={name} className="object-cover" />
        <AvatarFallback className="bg-primary/5 text-primary font-semibold">
          {getInitials(name)}
        </AvatarFallback>
      </BaseAvatar>
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
