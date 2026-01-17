import { useState } from 'react';
import { Wallet, Lock, Database } from 'lucide-react';
import { StatCard, StatCardSkeleton } from '@/components/dashboard/StatCard';
import { DonutChart } from '@/components/dashboard/DonutChart';
import { BarChartComponent } from '@/components/dashboard/BarChartComponent';
import { AuditDataTable } from '@/components/dashboard/AuditDataTable';
import {
  useStats,
  useAccounts,
  useDailyReclamation,
  useAccountDistribution,
} from '@/hooks/use-dashboard-data';

const Index = () => {
  const [chartRange, setChartRange] = useState(14);
  
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: dailyReclamation, isLoading: dailyLoading } = useDailyReclamation(chartRange);
  const { data: distribution, isLoading: distributionLoading } = useAccountDistribution();

  return (
    <div className="h-dvh overflow-auto bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground text-balance">
            Kora Rent Reclaim
          </h1>
          <p className="mt-1 text-muted-foreground">
            Monitor and track Solana rent reclamation activity
          </p>
        </header>

        {/* Summary Cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                title="Total Reclaimed"
                value={stats?.totalReclaimed.toFixed(4) ?? '0'}
                suffix="SOL"
                icon={Wallet}
              />
              <StatCard
                title="Active Locked"
                value={stats?.activeLocked.toFixed(4) ?? '0'}
                suffix="SOL"
                icon={Lock}
              />
              <StatCard
                title="Accounts Tracked"
                value={stats?.accountsTracked ?? 0}
                icon={Database}
              />
            </>
          )}
        </section>

        {/* Charts */}
        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <DonutChart
            data={distribution ?? []}
            isLoading={distributionLoading}
          />
          <BarChartComponent
            data={dailyReclamation ?? []}
            isLoading={dailyLoading}
            onRangeChange={setChartRange}
          />
        </section>

        {/* Data Table */}
        <section>
          <AuditDataTable
            data={accounts ?? []}
            isLoading={accountsLoading}
          />
        </section>
      </div>
    </div>
  );
};

export default Index;