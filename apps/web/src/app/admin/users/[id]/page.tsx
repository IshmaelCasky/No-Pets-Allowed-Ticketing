import { notFound } from "next/navigation";

import { Badge } from "@npa/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@npa/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@npa/ui/table";

import { formatCentavos, formatManilaDate } from "~/lib/format";
import { PageHeader } from "../../_components/page-header";
import {
  OrderStatusBadge,
  TicketStatusBadge,
} from "../../_components/status-badge";
import { getAdminCaller } from "../../_lib/caller";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caller = await getAdminCaller();
  const user = await caller.user.byId({ id });
  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={user.name} description={user.email} />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {user.banned ? (
              <Badge variant="destructive">Banned</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Phone: </span>
            {user.phone ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Joined: </span>
            {formatManilaDate(user.createdAt)}
          </div>
          {user.banned && user.banReason && (
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Ban reason: </span>
              {user.banReason}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders ({user.orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.orders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground h-16 text-center"
                  >
                    No orders.
                  </TableCell>
                </TableRow>
              ) : (
                user.orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">{o.code}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCentavos(o.totalAmount)}
                    </TableCell>
                    <TableCell>{formatManilaDate(o.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets ({user.tickets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.tickets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground h-16 text-center"
                  >
                    No tickets.
                  </TableCell>
                </TableRow>
              ) : (
                user.tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">
                      {user.orders.find((o) => o.id === t.orderId)?.code ?? "—"}
                    </TableCell>
                    <TableCell>{t.holderName ?? "—"}</TableCell>
                    <TableCell>
                      <TicketStatusBadge status={t.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
