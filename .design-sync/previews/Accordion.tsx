import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Badge,
} from "data-query-pro";

export const SchemaSections = () => (
  <div className="w-[480px]">
    <Accordion type="single" collapsible defaultValue="orders">
      <AccordionItem value="orders">
        <AccordionTrigger>public.orders</AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground">
            Customer orders with totals, status, and timestamps. 8 columns,
            12,480 rows. Foreign key to public.customers.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="customers">
        <AccordionTrigger>public.customers</AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground">
            Customer master records including billing region and signup date.
            6 columns, 3,102 rows.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="invoices">
        <AccordionTrigger>public.invoices</AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground">
            Issued invoices linked to orders, with payment state and due dates.
            7 columns, 11,907 rows.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);

export const ColumnDetails = () => (
  <div className="w-[480px]">
    <Accordion type="multiple" defaultValue={["pk", "fk"]}>
      <AccordionItem value="pk">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            id <Badge variant="secondary">primary key</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground">
            bigint, not null, auto-increment. Unique identifier for each order.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="fk">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            customer_id <Badge variant="outline">foreign key</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground">
            bigint, references public.customers(id). Links each order to its
            customer.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);
