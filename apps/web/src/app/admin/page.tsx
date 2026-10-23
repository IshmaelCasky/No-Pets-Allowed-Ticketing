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

import { formatCentavos } from "~/lib/format";
import { PageHeader } from "./_components/page-header";
import { getAdminCaller } from "./_lib/caller";

export default async function DashboardPage() {
  const caller = await getAdminCaller();
  const summary = await caller.dashboard.summary();

  const totalSold = summary.ticketsSoldByEvent.reduce(
    (s, e) => s + e.ticketsSold,
    0,
  );

  const stats = [
    { label: "Pending payment", value: String(summary.pendingPaymentCount) },
    {
      label: "Approved revenue",
      value: formatCentavos(summary.approvedRevenue),
    },
    { label: "Check-ins today", value: String(summary.checkInsToday) },
    { label: "Tickets sold (all events)", value: String(totalSold) },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of ticketing activity"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tickets sold per event</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Tickets sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.ticketsSoldByEvent.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-muted-foreground h-16 text-center"
                  >
                    No events yet.
                  </TableCell>
                </TableRow>
              ) : (
                summary.ticketsSoldByEvent.map((e) => (
                  <TableRow key={e.eventId}>
                    <TableCell>{e.eventTitle}</TableCell>
                    <TableCell className="text-right">
                      {e.ticketsSold}
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
