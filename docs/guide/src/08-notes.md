# Notes

Oneil renders parameter equations for review directly from code. This makes it easier to review code with complex equations.

If you've ever written a scientific paper, you know that there is often a lot of typeset math and narrative involved in deriving an equation. Showing your work like this helps you and others remember or review the reasons a parameter is expressed the way it is. To help you do this, Oneil supports notes — documentation attached to models, parameters, sections, and tests. Unlike `#` comments (which Oneil ignores), notes travel with the model and are shown in the **Rendered View** in the VS Code / Cursor extension.

Note bodies are **Markdown** (GitHub Flavored Markdown), with **LaTeX math**, **parameter interpolation**, and **citations**. Open a `.on` / `.one` file and run **Oneil: Open Rendered View** to see them formatted.

## Parameter Notes

| Attachment | Placement |
|------------|-----------|
| Model | At the top of the file (before parameters) |
| Parameter | Immediately after the parameter declaration |
| Section | Immediately after a `section Label` line |
| Test | Immediately after a `test: …` line |

## Delimiters

Single-line notes start with `~`:

```oneil
Rotation rate: omega = 1 :deg/min

Cylinder radius: r = d/2 :km

    ~ The distance from the center of the cylinder to the inner rim.
```

You can use three tildes to start and end a multi-line note:

```oneil
Artificial gravity: g_a = r*omega^2 :m/s^2

    ~~~
    The position of a point on the rim of a rotating cylinder is:

    $\vec{r}(t) = r\cos(\omega t)\,\hat{i} + r\sin(\omega t)\,\hat{j}$

    Taking the first derivative gives the velocity:

    $\vec{v}(t) = \frac{d\vec{r}}{dt} = -r\omega\sin(\omega t)\,\hat{i} + r\omega\cos(\omega t)\,\hat{j}$

    Taking the second derivative gives the acceleration:

    $\vec{a}(t) = \frac{d\vec{v}}{dt} = -r\omega^2\cos(\omega t)\,\hat{i} - r\omega^2\sin(\omega t)\,\hat{j} = -\omega^2\vec{r}(t)$

    The acceleration points radially inward (toward the center), and its magnitude is:

    $|\vec{a}| = r\omega^2$

    This centripetal acceleration acts as artificial gravity for inhabitants
    standing on the inner rim of the cylinder, so $g_a = r\omega^2$.
    ~~~
```

## Sections and Section Notes

The `section` keyword will produce a header when rendered. Sections can be given their own notes:

```oneil

Earth gravity: g_E = 9.81 :m/s^2

section Tests

    ~ The following tests ensure that the artificial gravity of the station won't exceed a \href{https://www.reddit.com/r/scifiwriting/comments/szwvep/what_is_the_highest_gravity_that_humans_could/}{livable range for human occupants}.

test : g_a < 1.1*g_E
```

Notes can also attach to the model (at the top of the file) and to individual `test:` lines.

## Parameter LaTeX / rendered names

In the Rendered View, each parameter is shown with a math symbol. You can set that symbol explicitly with braces after the colon (before the identifier):

```oneil
Velocity: {\hat{v}} v = 0 :m/s
Surface area: {A_{\mathrm{s}}} A = 4 * pi * R^2 :m^2
```

If you omit `{…}`, the viewer derives a symbol from the identifier (`omega` → $\omega$, `A_hab` → $A_{hab}$, and so on).

## Markdown, math, and links

Besides inline `$…$` math (as in the examples above), the Rendered View also supports display math (`$$…$$`), `\begin{equation}…\end{equation}`, and ordinary Markdown: headings, lists, tables, code, images, and links.

Markdown links work as `[text](url)`.

Images use `![alt](./path.png)` (model-file directory first, then the workspace root). A leading `/` is workspace-root only. PDF paths in image links are recognized by the extension.

## Parameter interpolation

Insert a live parameter into a note with `{{identifier:mode}}`:

| Placeholder | Meaning |
|-------------|---------|
| `{{name:value}}` | The parameter’s evaluated value (and unit) |
| `{{name:equation}}` | The parameter’s defining expression |

```oneil
Habitable area: A_hab = 3/6 * A_tot :km^2

    ~ Land stripes only: {{A_hab:equation}} = {{A_hab:value}}.
```

Placeholders also work inside math mode. See `examples/oneil_cylinder.on` for more.

## Citations and bibliography

### Citation syntax

Citations follow a Pandoc-style convention. Keys must match an entry in a BibTeX file (see below).

**Bracketed (parenthetical)**

| Syntax | Renders as |
|--------|------------|
| `[@key]` | `(Author, year)` |
| `[@k1; @k2]` | Multiple citations |
| `[+@key]` | All authors listed |
| `[-@key]` | `(year)` only |
| `[!@key]` | Author name without parentheses |
| `[@key, p. 42]` / `pp. 12-15` | Open / jump to that page of the PDF |

```oneil
    ~ Island Three is described in *The High Frontier* [@ONeill1977].
    ~ Crew health limits are in [@NASA-STD-3001, p. 12].
```

**Textual (narrative)**

| Syntax | Renders as |
|--------|------------|
| `@key` | `Author (year)` |
| `+@key` / `-@key` / `!@key` | Full authors / year / author only |

```oneil
    ~ @ONeill1977 described Island Three in *The High Frontier*.
```

In the Rendered View, citations are clickable. The **bibliography panel** lists entries cited in the focused note.

### Where to put the `.bib` file

Prefer a file named **`references.bib`**. Search order matches note images: the model file’s directory first, then the workspace. Most preferred first:

1. `references.bib` in the **same directory** as the open `.on` / `.one` file
2. Other `*.bib` files in that directory
3. `references.bib` at each **workspace folder root**
4. Remaining `*.bib` files anywhere in the workspace (shallower paths first; `node_modules` skipped)

All readable matches are concatenated, so you can keep a shared workspace bibliography plus a model-local one.

A worked example lives in the repo at [`examples/references.bib`](https://github.com/careweather/oneil/blob/main/examples/references.bib), used by [`examples/oneil_cylinder.on`](https://github.com/careweather/oneil/blob/main/examples/oneil_cylinder.on).

### Citing a PDF

When you click on `[@key]` (or `[@key, p. N]`) in the Rendered View the extension can open the PDF on the right page. To make sure that the extension can find the PDF ensure that you setup `references.bib` as follows:

**1. Put a direct PDF `url` on the BibTeX entry**

Prefer `url` set to a file that actually serves a PDF. That is what **Download & Cache** needs, so later clicks open the cached copy instead of a browser.

```bibtex
@techreport{NASA-STD-3001,
  author = {{NASA}},
  title  = {NASA Space Flight Human-System Standard, Volume 1: Crew Health},
  year   = {2014},
  url    = {https://standards.nasa.gov/.../nasa-std-3001-....pdf},
}
```

A `doi` alone (bare identifier, e.g. `10.1088/1681-7575/ac0240`) opens `https://doi.org/…` — a publisher page, not a PDF — so each click goes to the browser. Use `doi` as extra metadata if you like; do not rely on it for caching.

**2. Cite it in a note**

```oneil
    ~ See the crew health limits [@NASA-STD-3001, p. 12].
```

The page locator (`p. 12`, `pp. 12-15`, or a bare `, 12`) is what jumps the PDF viewer. For a default page whenever the cite has no locator, set `pdfpage = {12}` on the BibTeX entry.

**3. Let the extension cache the PDF**

1. Open the model in **Oneil: Open Rendered View**.
2. Click the citation.
3. When prompted, choose **Download & Cache**. The file is stored under the PDF cache directory (default `~/.local/oneil/resources/`, override with `oneil.pdf.cacheDir`).
4. When prompted, choose **Update references.bib**. The extension writes a portable `file` field, e.g.:

```bibtex
  file = {:nasa-space-flight-human-system-standard-volume-1_488d61c2.pdf:PDF},
```

That bare filename is resolved back through the cache directory, so teammates on other machines can re-download (or share the cache) without absolute paths.

Turn on **Oneil: PDF Auto Download** (`oneil.pdf.autoDownload`) if you want step 3 without the prompt. **Oneil: Toggle PDF Offline Mode** only opens already-cached files.

**4. Optional: point `file` at a project PDF yourself**

If the PDF already lives in the repo (or anywhere on disk), set `file` manually instead of using the cache:

```bibtex
  file = {:./papers/nasa-std-3001.pdf:PDF},
  % or an absolute path / JabRef-style Description:path:PDF
```

Resolution order when you click a cite:

1. BibTeX `file` (absolute, `~/…`, `./…` relative to the model file then the workspace root, or bare name in the PDF cache)
2. Cache entry already downloaded for that URL
3. Download from `url` when the response is a PDF (unless offline), then optionally update `references.bib`
4. Open `url`, or `https://doi.org/<doi>` if there is no `url`, in the browser

### Useful BibTeX fields

| Field | Role |
|-------|------|
| `author`, `title`, `year` | Citation labels and bibliography list |
| `url` | Direct PDF link (recommended). Used to download into the cache |
| `doi` | Bare identifier, e.g. `10.1088/1681-7575/ac0240`. Opens the publisher page; does not cache a PDF |
| `file` | Local or cache path (`:filename.pdf:PDF`, `./relative.pdf`, or absolute) |
| `pdfpage` | Default page when the cite has no `p.` / `pp.` locator |
