# Offline behavior

Cached catalog/products and the signed-in Doctor's cached order history can be read offline. Cached surfaces show a subtle Arabic stale/offline indicator. Authentication, profile writes, checkout, order creation, support submission, password operations, and uncached server search are blocked while offline and never queued.

The persistence layer is platform-specific behind one interface. User-scoped queries include the user ID in their keys and are removed on logout/account change.
