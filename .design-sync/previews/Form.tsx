import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  Input,
  Button,
} from "data-query-pro";
import { useForm } from "react-hook-form";

export const ConnectionForm = () => {
  const form = useForm({
    defaultValues: {
      name: "CloudMetrics Prod",
      host: "db.cloudmetrics.internal",
      port: "5432",
    },
  });

  return (
    <Form {...form}>
      <form className="w-[420px] space-y-5" onSubmit={(e) => e.preventDefault()}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Connection name</FormLabel>
              <FormControl>
                <Input placeholder="My production database" {...field} />
              </FormControl>
              <FormDescription>A friendly label shown in the sidebar.</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="host"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Host</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="port"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Port</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit">Save connection</Button>
      </form>
    </Form>
  );
};

export const WithValidationError = () => {
  const form = useForm({ defaultValues: { database: "" } });

  return (
    <Form {...form}>
      <form className="w-[420px] space-y-5" onSubmit={(e) => e.preventDefault()}>
        <FormField
          control={form.control}
          name="database"
          rules={{ required: true }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Database name</FormLabel>
              <FormControl>
                <Input placeholder="cloudmetrics" {...field} />
              </FormControl>
              <FormDescription>The schema this connection will query.</FormDescription>
              <FormMessage>Database name is required.</FormMessage>
            </FormItem>
          )}
        />
        <Button type="submit">Test connection</Button>
      </form>
    </Form>
  );
};
