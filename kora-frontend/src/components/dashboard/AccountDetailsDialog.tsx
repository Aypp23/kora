import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AccountData } from '@/lib/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';

interface AccountDetailsDialogProps {
  account: AccountData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountDetailsDialog({ account, open, onOpenChange }: AccountDetailsDialogProps) {
  if (!account) return null;

  const statusVariant = {
    active: 'active' as const,
    reclaimed: 'reclaimed' as const,
    pending: 'pending' as const,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-balance">Account Details</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Full information for the selected account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Address</p>
            <p className="font-mono text-sm text-foreground break-all">{account.address}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={statusVariant[account.status]} className="capitalize">
                {account.status}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="font-medium text-foreground tabular-nums">
                {account.balance.toFixed(6)} SOL
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Last Activity</p>
              <p className="text-sm text-foreground">
                {formatDistanceToNow(account.lastActivity, { addSuffix: true })}
              </p>
            </div>

            {account.reclamationTx && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Reclamation TX</p>
                <a
                  href={`https://solscan.io/tx/${account.reclamationTx}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  title={account.reclamationTx}
                >
                  {`${account.reclamationTx.slice(0, 4)}...${account.reclamationTx.slice(-4)}`}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </div>

          {account.reclaimReason && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
              <p className="text-sm font-medium text-foreground">Reclamation Reason</p>
              <p className="text-sm text-muted-foreground">{account.reclaimReason}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
