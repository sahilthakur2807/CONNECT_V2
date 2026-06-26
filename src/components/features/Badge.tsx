import * as React from 'react';
import { ShieldCheck, Shield, TrendingUp, Zap, Wifi, WifiOff, Ban, Award, Clock, MessageSquare } from 'lucide-react';
import { cn } from '@/utils/cn';

export type BadgeVariant =
  | 'verified'
  | 'superadmin'
  | 'super-admin'
  | 'admin'
  | 'moderator'
  | 'trending'
  | 'new'
  | 'active'
  | 'online'
  | 'offline'
  | 'suspended'
  | 'top-contributor'
  | 'early-member'
  | 'popular-discussion';

interface BadgeProps {
  variant: BadgeVariant;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

const configs: Record<BadgeVariant, { label: string; icon: React.ReactNode; className: string }> = {
  verified: {
    label: 'Verified',
    icon: <ShieldCheck size={12} />,
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  'super-admin': {
    label: 'Super Admin',
    icon: <Shield size={12} />,
    className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  },
  superadmin: {
    label: 'Super Admin',
    icon: <Shield size={12} />,
    className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  },
  admin: {
    label: 'Admin',
    icon: <Shield size={12} />,
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  },
  moderator: {
    label: 'Moderator',
    icon: <Shield size={12} />,
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  },
  trending: {
    label: 'Trending',
    icon: <TrendingUp size={12} />,
    className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  },
  new: {
    label: 'New',
    icon: <Zap size={12} />,
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  },
  active: {
    label: 'Active',
    icon: <Wifi size={12} />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  online: {
    label: 'Online',
    icon: <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />,
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  },
  offline: {
    label: 'Offline',
    icon: <WifiOff size={12} />,
    className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  },
  suspended: {
    label: 'Suspended',
    icon: <Ban size={12} />,
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  },
  'top-contributor': {
    label: 'Top Contributor',
    icon: <Award size={12} />,
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  },
  'early-member': {
    label: 'Early Member',
    icon: <Clock size={12} />,
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  },
  'popular-discussion': {
    label: 'Popular Discussion',
    icon: <MessageSquare size={12} />,
    className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  },
};

export function Badge({ variant, size = 'sm', showIcon = true, className }: BadgeProps) {
  const config = configs[variant];
  if (!config) return null;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold border transition-colors',
        sizeClass,
        config.className,
        className
      )}
      aria-label={config.label}
    >
      {showIcon && config.icon}
      {config.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: 'online' | 'offline' | 'suspended'; className?: string }) {
  const colors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    suspended: 'bg-red-500',
  };
  return (
    <span
      className={cn('inline-block w-2.5 h-2.5 rounded-full border-2 border-white dark:border-background', colors[status], className)}
      aria-label={status}
    />
  );
}
