# photo-graph

Explore a nested photo directory as an Obsidian-style force graph. Folders are
expandable nodes; drop a `thisnode.png` in any folder and it becomes that
node's round icon. Photos orbit their folder as small round thumbnails —
click one for a full-size lightbox.

Zero npm dependencies — d3 is bundled in `public/`.

## Run (WSL2 / any Node ≥ 16)

```bash
node server.js /path/to/your/photos        # default port 8420
node server.js ~/Pictures 9000             # custom port
```

Open http://localhost:8420 (WSL2 forwards localhost to Windows automatically).

## Controls

| Action            | Result                          |
|-------------------|---------------------------------|
| Click folder      | Expand / collapse (lazy-loaded) |
| Click photo       | Lightbox (← / → cycles siblings, Esc closes) |
| Drag node         | Pin it in place                 |
| Double-click node | Unpin                           |
| Scroll / pinch    | Zoom; drag canvas to pan        |

## Notes

- Folder icon file: `thisnode.png` (case-insensitive). Folders without one get
  an amber initial-letter disc instead.
- The badge on a collapsed folder shows its child count (subfolders + photos).
- Recognized photo types: png, jpg/jpeg/jfif, webp, gif, avif, bmp, svg.
  Hidden dotfiles/dotdirs are skipped.
- Thumbnails load the original files (no server-side resizing). Fine on
  localhost; folders with thousands of multi-MB photos will be slow to expand.
- Paths are sandboxed to the root you pass in — `../` traversal is rejected.
- The server binds all interfaces; it's meant for localhost/LAN use, not the
  open internet (no auth).
