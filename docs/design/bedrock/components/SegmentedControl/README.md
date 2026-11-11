# SegmentedControl

A choice between 2 to 5 short, exclusive options, with the pill sliding to the chosen one.

- Chart periods: **7D · 30D · 90D · 1Y**. Status filters: **All · Paid · Pending · Late**.
- The pill moves in `duration-base` / `ease-standard`; no motion with `prefers-reduced-motion`.
- More than 5 options or long labels: use a Select.
- `block` takes the full width on phones.

The consumer provides the options and the value. Implementation: shadcn/ui `ToggleGroup` (single), which already gives arrow-key navigation.
