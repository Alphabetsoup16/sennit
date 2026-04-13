# Private design notes

Git ignores everything in **`private-docs/`** except this file (see root **`.gitignore`**). Use it for contracts and backlogs you do not ship in the public tree.

| File (local only) | Typical contents |
|-------------------|------------------|
| **`PASSTHROUGH-AND-MERGE.md`** | Capability matrix, merge rules, roots contract, roadmap |
| **`ENGINEERING_QUALITY_PLAN.md`** | Engineering / audit backlog |

CI and clean clones do not require these. Repo references to **`private-docs/…`** are for maintainers who keep copies here.

Public contributor docs: [`docs/`](../docs/).
