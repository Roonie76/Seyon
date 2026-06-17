'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { verifyShopAction, suspendShopAction, resolveReportAction } from '@/actions/admin';
import { ReportStatus, Report, Shop } from '@prisma/client';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

type AdminReport = Report & {
  shop: { name: string; slug: string };
  user: { name: string | null; email: string | null };
};

type AdminStore = Shop & {
  owner: { email: string | null };
};

interface AdminModerationProps {
  reports: AdminReport[];
  allStores: AdminStore[];
  buyerMarketUrl?: string;
}

export function AdminModeration({ reports: initialReports, allStores: initialStores, buyerMarketUrl }: AdminModerationProps) {
  const [reports, setReports] = React.useState(initialReports);
  const [stores, setStores] = React.useState(initialStores);

  const handleVerifyToggle = async (shopId: string, currentStatus: boolean) => {
    const res = await verifyShopAction(shopId, !currentStatus);
    if (res.error) {
      alert(res.error);
    } else {
      setStores((prev) =>
        prev.map((s) => (s.id === shopId ? { ...s, isVerified: !currentStatus } : s))
      );
    }
  };

  const handleSuspendToggle = async (shopId: string, currentStatus: boolean) => {
    const actionWord = currentStatus ? 'unsuspend' : 'suspend';
    if (!confirm(`Are you sure you want to ${actionWord} this storefront?`)) return;

    const res = await suspendShopAction(shopId, !currentStatus);
    if (res.error) {
      alert(res.error);
    } else {
      setStores((prev) =>
        prev.map((s) => (s.id === shopId ? { ...s, isSuspended: !currentStatus } : s))
      );
    }
  };

  const handleResolveReport = async (reportId: string, status: ReportStatus) => {
    const res = await resolveReportAction(reportId, status);
    if (res.error) {
      alert(res.error);
    } else {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Reports Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" /> Buyer Abuse Reports ({reports.filter(r => r.status !== 'RESOLVED').length} active)
        </h2>
        {reports.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-lg text-center text-muted-foreground text-xs bg-card">
            No abuse reports have been filed.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Storefront</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((rep) => (
                <TableRow key={rep.id} className={rep.status === 'RESOLVED' ? 'opacity-50' : ''}>
                  <TableCell>
                    <a href={`${buyerMarketUrl || ''}/store/${rep.shop.slug}`} target="_blank" className="font-bold text-foreground hover:underline">
                      {rep.shop.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs">{rep.user.email}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate" title={rep.reason}>
                    {rep.reason}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rep.status === 'OPEN' ? 'destructive' : rep.status === 'RESOLVED' ? 'success' : 'warning'}>
                      {rep.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {rep.status !== 'RESOLVED' ? (
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="h-8 text-[10px] px-2.5" onClick={() => handleResolveReport(rep.id, 'RESOLVED')}>
                          Mark Resolved
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] text-muted-foreground" onClick={() => handleResolveReport(rep.id, 'UNDER_REVIEW')}>
                          Under Review
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-semibold">Done</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Stores Moderation Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Platform Storefronts Directory
        </h2>
        {stores.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-lg text-center text-muted-foreground text-xs bg-card">
            No stores registered on the platform.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store Name</TableHead>
                <TableHead>Owner Email</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Moderation Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <a href={`${buyerMarketUrl || ''}/store/${s.slug}`} target="_blank" className="font-bold text-foreground hover:underline flex items-center gap-1.5">
                      {s.name}
                      {s.isVerified && <ShieldCheck className="h-4 w-4 text-emerald-400" />}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs">{s.owner.email}</TableCell>
                  <TableCell>
                    <Badge variant={s.isVerified ? 'success' : 'outline'}>
                      {s.isVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.isSuspended ? 'destructive' : 'success'}>
                      {s.isSuspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        onClick={() => handleVerifyToggle(s.id, s.isVerified)}
                      >
                        {s.isVerified ? 'Revoke Verification' : 'Verify Seller'}
                      </Button>
                      <Button
                        variant={s.isSuspended ? 'whatsapp' : 'destructive'}
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        onClick={() => handleSuspendToggle(s.id, s.isSuspended)}
                      >
                        {s.isSuspended ? 'Unsuspend' : 'Suspend'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
export default AdminModeration;
