import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BarChartData {
  date: string;
  amount: number;
}

interface BarChartComponentProps {
  data: BarChartData[];
  isLoading?: boolean;
  onRangeChange?: (days: number) => void;
}

const RANGES = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
];

export function BarChartComponent({ data, isLoading, onRangeChange }: BarChartComponentProps) {
  const [selectedRange, setSelectedRange] = useState(14);

  const handleRangeChange = (days: number) => {
    setSelectedRange(days);
    onRangeChange?.(days);
  };

  if (isLoading) {
    return <BarChartSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium text-foreground text-balance">
              Daily Reclamation Volume (SOL)
            </CardTitle>
            <div className="flex gap-1">
              {RANGES.map(({ label, days }) => (
                <Button
                  key={days}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 px-2 text-xs',
                    selectedRange === days
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => handleRangeChange(days)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  minTickGap={30}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value.toFixed(2)} SOL`, 'Reclaimed']}
                />
                <Bar
                  dataKey="amount"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function BarChartSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <div className="flex gap-1">
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-7 w-10" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-[240px] items-end justify-around gap-2 pt-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="w-8"
              style={{ height: `${Math.random() * 60 + 40}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
