import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  suffix?: string;
  isLoading?: boolean;
}

export function StatCard({ title, value, icon: Icon, suffix, isLoading }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-balance">{title}</p>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className={cn(
                  "text-2xl font-semibold text-foreground",
                  typeof value === 'number' && "tabular-nums"
                )}>
                  {value}
                  {suffix && <span className="ml-1 text-sm text-muted-foreground">{suffix}</span>}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-secondary p-2">
              <Icon className="size-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
