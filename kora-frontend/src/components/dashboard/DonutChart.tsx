import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DonutChartProps {
  data: Array<{ name: string; value: number; fill: string }>;
  isLoading?: boolean;
}

export function DonutChart({ data, isLoading }: DonutChartProps) {
  if (isLoading) {
    return <DonutChartSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-foreground text-balance">
            Account Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  isAnimationActive={true}
                  animationBegin={200}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(215 28% 20%)',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--foreground))',
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend
                  verticalAlign="bottom"
                  formatter={(value) => (
                    <span className="text-sm text-muted-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DonutChartSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <div className="flex h-[240px] items-center justify-center">
          <Skeleton className="size-40 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}
