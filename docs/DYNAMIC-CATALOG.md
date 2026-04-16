# Dynamic Catalog Behavior

Sennit supports upstream `list_changed` notifications (`dynamicToolList`, `dynamicResourceList`, `dynamicPromptList`) and forwards them to connected hosts.

Current behavior:

- Host sessions are notified (`sendToolListChanged`, etc.).
- Registrations are still built at connect time.
- Reconnect to Sennit to guarantee full merged catalog rebuild.

Why this fallback remains:

- It avoids registration churn races while upstream sessions are mid-call.
- It keeps the host-visible surface deterministic for a single session.

Planned evolution:

- Incremental add/remove registration refresh per session using SDK registration handles.
