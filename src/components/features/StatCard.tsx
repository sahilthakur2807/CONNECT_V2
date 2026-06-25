import { cn } from '@/utils/cn';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({ label, value, icon, trend, trendType = 'up', className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border/50 shadow-sm rounded-2xl transition-all hover:shadow-md", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            {icon}
          </div>
          {trend && (
            <div className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg",
              trendType === 'up' && "bg-green-50 text-green-600 dark:bg-green-950/30",
              trendType === 'down' && "bg-red-50 text-red-600 dark:bg-red-950/30",
              trendType === 'neutral' && "bg-secondary text-muted-foreground"
            )}>
              {trend}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
