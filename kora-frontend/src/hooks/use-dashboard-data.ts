import { useQuery } from '@tanstack/react-query';
import {
  fetchStats,
  fetchAccounts,
  fetchDailyReclamation,
  fetchAccountDistribution,
} from '@/lib/mock-data';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });
}

export function useDailyReclamation(days: number = 14) {
  return useQuery({
    queryKey: ['dailyReclamation', days],
    queryFn: () => fetchDailyReclamation(days),
  });
}

export function useAccountDistribution() {
  return useQuery({
    queryKey: ['accountDistribution'],
    queryFn: fetchAccountDistribution,
  });
}
