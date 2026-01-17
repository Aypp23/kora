import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Eye, ChevronLeft, ChevronRight, ArrowUpDown, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AccountData } from '@/lib/mock-data';
import { AccountDetailsDialog } from './AccountDetailsDialog';

interface AuditDataTableProps {
  data: AccountData[];
  isLoading?: boolean;
}

type SortField = 'address' | 'status' | 'balance' | 'lastActivity';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

export function AuditDataTable({ data, isLoading }: AuditDataTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('lastActivity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAccount, setSelectedAccount] = useState<AccountData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (search) {
      filtered = filtered.filter((account) =>
        account.address.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((account) => account.status === statusFilter);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'address':
          comparison = a.address.localeCompare(b.address);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'balance':
          comparison = a.balance - b.balance;
          break;
        case 'lastActivity':
          comparison = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [data, search, statusFilter, sortField, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedData, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleViewDetails = (account: AccountData) => {
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  const statusVariant = {
    active: 'active' as const,
    reclaimed: 'reclaimed' as const,
    pending: 'pending' as const,
  };

  if (isLoading) {
    return <AuditDataTableSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium text-foreground text-balance">
            Audit Data
          </CardTitle>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by address..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="reclaimed">Reclaimed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort('address')}
                    >
                      Address
                      <ArrowUpDown className="ml-2 size-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort('status')}
                    >
                      Status
                      <ArrowUpDown className="ml-2 size-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-3 h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort('balance')}
                    >
                      Balance
                      <ArrowUpDown className="ml-2 size-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort('lastActivity')}
                    >
                      Last Activity
                      <ArrowUpDown className="ml-2 size-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono text-sm">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors group"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(account.address);
                            toast({
                              title: "Address copied",
                              description: "Wallet address copied to clipboard",
                              duration: 2000,
                            });
                          }}
                        >
                          {account.address}
                          <Copy className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[account.status]} className="capitalize">
                          {account.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {account.balance.toFixed(6)} SOL
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(account.lastActivity, { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleViewDetails(account)}
                          aria-label="View account details"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedData.length)} of{' '}
                {filteredAndSortedData.length} accounts
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AccountDetailsDialog
        account={selectedAccount}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </motion.div>
  );
}

function AuditDataTableSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <Skeleton className="h-5 w-24" />
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-10 w-full max-w-xs" />
          <Skeleton className="h-10 w-40" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
