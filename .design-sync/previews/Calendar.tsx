import { Calendar } from "data-query-pro";

export const ReportDatePicker = () => (
  <Calendar
    mode="single"
    selected={new Date(2026, 5, 16)}
    defaultMonth={new Date(2026, 5, 16)}
    className="rounded-md border"
  />
);
