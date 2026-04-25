---
name: design-doc-writer
description: Use when writing or rewriting DESIGN.md for a software project from sparse product intent, especially when the document should name implementation concepts, define components, and stay concise.
---

# Design Doc Writer

Read repository instructions and the existing `DESIGN.md` before editing.
Treat the first pass as a reader review: check structure, ordering, prose
quality, redundancy, and missing implementation concepts.

Define the project first in one or two paragraphs. State what the system does,
then name the main transformation or design idea.

Organize the document by concepts and components. Give each concept a stable
name, a short definition, and the rules needed to implement it.

Prefer declarative prose. Each paragraph should introduce one concept, state
its properties, and stop.

Specify ownership, data flow, lifecycle, sizing, and failure behavior when they
affect implementation.

After editing, reread the document as a reader. Remove policy-like filler,
redundant sections, and vague statements. Tighten any sentence that does not
help implementation.
