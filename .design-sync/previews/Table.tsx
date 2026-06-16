import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Badge,
} from "data-query-pro";

const rows = [
  { id: "#10428", customer: "Acme Corp", status: "Paid", amount: "$1,240.00" },
  { id: "#10429", customer: "Globex LLC", status: "Pending", amount: "$320.50" },
  { id: "#10430", customer: "Initech", status: "Paid", amount: "$5,980.00" },
  { id: "#10431", customer: "Umbrella Co", status: "Refunded", amount: "$0.00" },
];

export const QueryResults = () => (
  <div className="w-[560px]">
    <Table>
      <TableCaption>Recent results — cloudmetrics.orders</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.id}</TableCell>
            <TableCell>{r.customer}</TableCell>
            <TableCell>
              <Badge variant={r.status === "Paid" ? "default" : "secondary"}>{r.status}</Badge>
            </TableCell>
            <TableCell className="text-right">{r.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
