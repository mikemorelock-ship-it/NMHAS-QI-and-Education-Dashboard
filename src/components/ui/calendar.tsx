"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";

import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:2.25rem]",
        "[[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex gap-6 flex-col md:flex-row relative", defaultClassNames.months),
        month: cn("flex flex-col w-full gap-3", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between z-10",
          defaultClassNames.nav
        ),
        button_previous: cn(
          "inline-flex items-center justify-center rounded-lg",
          "size-8 p-0 hover:bg-muted transition-colors",
          "text-muted-foreground hover:text-foreground",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          "inline-flex items-center justify-center rounded-lg",
          "size-8 p-0 hover:bg-muted transition-colors",
          "text-muted-foreground hover:text-foreground",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-8 w-full px-8",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-8 gap-1.5",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn("absolute bg-popover inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-semibold text-sm tracking-tight text-foreground",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground/60 rounded-md flex-1 font-medium text-[0.7rem] uppercase tracking-wider select-none",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-0.5", defaultClassNames.week),
        week_number_header: cn("select-none w-(--cell-size)", defaultClassNames.week_number_header),
        week_number: cn(
          "text-[0.8rem] select-none text-muted-foreground",
          defaultClassNames.week_number
        ),
        day: cn(
          "relative w-full h-full p-0 text-center group/day aspect-square select-none",
          "[&:first-child[data-selected=true]_button]:rounded-l-md",
          "[&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day
        ),
        range_start: cn("rounded-l-md bg-[#00b0ad]/15", defaultClassNames.range_start),
        range_middle: cn("rounded-none bg-[#00b0ad]/8", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-[#00b0ad]/15", defaultClassNames.range_end),
        today: cn("relative", defaultClassNames.today),
        outside: cn(
          "text-muted-foreground/30 aria-selected:text-muted-foreground/50",
          defaultClassNames.outside
        ),
        disabled: cn("text-muted-foreground/25 cursor-not-allowed", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          }
          return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isSelected =
    modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle;

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-today={modifiers.today || undefined}
      data-selected-single={isSelected}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        // Base
        "relative inline-flex items-center justify-center",
        "size-[--cell-size] rounded-lg text-sm tabular-nums",
        "transition-colors duration-100 select-none",
        "hover:bg-[#00b0ad]/10 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b0ad]/40 focus-visible:ring-offset-1",

        // Today dot indicator
        "data-[today=true]:after:absolute data-[today=true]:after:bottom-[3px] data-[today=true]:after:left-1/2",
        "data-[today=true]:after:-translate-x-1/2 data-[today=true]:after:size-[3px]",
        "data-[today=true]:after:rounded-full data-[today=true]:after:bg-[#00b0ad]",
        "data-[today=true]:font-semibold",

        // Selected single day
        "data-[selected-single=true]:bg-[#00b0ad] data-[selected-single=true]:text-white",
        "data-[selected-single=true]:font-semibold data-[selected-single=true]:shadow-sm",
        "data-[selected-single=true]:hover:bg-[#009e9b]",
        "data-[selected-single=true]:after:bg-white",

        // Range start — solid teal, rounded left
        "data-[range-start=true]:bg-[#00b0ad] data-[range-start=true]:text-white",
        "data-[range-start=true]:font-semibold data-[range-start=true]:shadow-sm",
        "data-[range-start=true]:rounded-lg",
        "data-[range-start=true]:hover:bg-[#009e9b]",
        "data-[range-start=true]:after:bg-white",

        // Range end — solid teal, rounded right
        "data-[range-end=true]:bg-[#00b0ad] data-[range-end=true]:text-white",
        "data-[range-end=true]:font-semibold data-[range-end=true]:shadow-sm",
        "data-[range-end=true]:rounded-lg",
        "data-[range-end=true]:hover:bg-[#009e9b]",
        "data-[range-end=true]:after:bg-white",

        // Range middle — transparent, tinted on hover
        "data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-foreground",
        "data-[range-middle=true]:rounded-none",
        "data-[range-middle=true]:hover:bg-[#00b0ad]/15",

        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
