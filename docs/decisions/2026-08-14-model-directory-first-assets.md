# Model-directory-first asset resolution

## Status

Accepted

## Context

The Rendered View resolved note images against the **workspace root** first (then the model file’s directory), but discovered `references.bib` in the **model file’s directory** first (then the workspace root). The two rules were documented next to each other and felt inconsistent.

`./path` normally means “relative to this file.” A model-local bibliography or figure should also win when the same name exists at the workspace root. `/path` already means “from the workspace root,” so shared assets do not need workspace-first relative lookup.

## Decision

Resolve relative note assets and conventional files against the **model file’s directory first**, then the workspace root:

- `![alt](./diagram.png)` and `![alt](diagram.png)` — model directory, then workspace root
- `![alt](/images/diagram.png)` — workspace root only
- `references.bib` / other `*.bib` — model directory, then workspace root (unchanged)
- BibTeX `file = {:./papers/x.pdf:PDF}` — model directory, then workspace root

When both locations exist, the model-local file is used.

## Consequences

- Co-located figures and bibliographies work without `../` prefixes.
- A shared `images/` or `references.bib` at the workspace root still works as a fallback.
- Name collisions prefer the more specific (model-local) file.
- A workspace-only `./images/foo.png` still loads via the fallback; `/images/foo.png` is the explicit workspace-root form.
