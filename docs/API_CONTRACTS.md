# API contracts

Repository contracts expose authentication, catalog queries, media resolution, profile/default address, settings, orders, and support cases. UI code consumes domain models, not raw database rows.

The order-creation RPC accepts an idempotency key, requested display currency, delivery address snapshot, recipient snapshot, optional delivery notes, and an array of product IDs with positive integer quantities. It never accepts authoritative prices or totals. It returns the created order ID, number, currency snapshots, subtotal, fees, tax, and total.
