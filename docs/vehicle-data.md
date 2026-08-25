# Vehicle data and maintenance guidance

The Car tab is a private paper trail for work you already did or reminders you deliberately set. It is not a diagnostic tool, a recall database, or a replacement for your vehicle's owner manual.

## What it records

- A vehicle nickname, with optional year, make, model, distance unit, currency, manual link, and freeform notes
- Completed service date, title, category, odometer, provider, and whether the work was DIY, dealer, shop, roadside, or inspection-station work
- Optional total, parts, and labor costs
- Preset-specific details for oil, tires, brakes, battery, inspections, fluids and filters, and repairs
- Optional next-due date or odometer, warranty boundary, and receipt or work-order reference

Vehicle profiles and maintenance entries are separate, append-only Markdown files. The app does not request a VIN or license plate, upload receipts, infer a maintenance schedule, or send vehicle data to an outside API.

## Why reminders are entered by hand

Maintenance schedules depend on the exact vehicle and sometimes on driving conditions. The US Federal Trade Commission recommends following the maintenance schedule in the owner's manual, and keeping completed repair orders with the work performed, parts, labor, cost, and odometer reading. Those are the details this log makes easy to keep.

- [FTC: Auto Repair Basics](https://consumer.ftc.gov/articles/0211-auto-repair-basics)
- [FTC: Auto Warranties and Auto Service Contracts](https://consumer.ftc.gov/articles/auto-warranties-and-auto-service-contracts)

The quick presets help shape a record; they do not contain universal time or mileage intervals. Add a next-due date or odometer only when it comes from a source you trust for your vehicle.

## Recalls

The interface links to [NHTSA's official recall lookup](https://www.nhtsa.gov/recalls). That page can check a VIN or license plate directly with NHTSA. Private Capture does not fill the form, receive the result, or keep the identifier.

## Backups and resale

Maintenance records can matter for warranty questions, troubleshooting, and resale. Plain Markdown makes them portable, but sync is not a backup. Keep separate versioned backups of the approved root and never put real records in public bug reports or screenshots.
