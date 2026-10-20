# Changelog

## 1.6.19 - 2026-10-20

- Add **auto_load_img**, **Stop**, and a combined image counter for the current part and the next unfinished part.
- Download up to three images concurrently in the background and keep compressed images in IndexedDB instead of decoding the entire pair into RAM.
- Release the first part's cache after all its frames are successfully saved as Done, then load the next unfinished part. Preserve the overlapping part.
- Keep completed downloads on Stop; resume missing images for the currently open part and the next part. Share foreground/background requests for the same image.
- Clear preloader state on session, label, resolution/quality or mode changes. Display failed downloads and storage errors without blocking normal viewing.
- Prepare up to three nearby frames when navigating with `A` / `D`.

## 1.6.18 - 2026-10-20

- Translate the extension interface, dialogs, notifications, updater setup, and native updater messages into English.
- Add five installation screenshots to the GitHub README, with a concise feature guide and complete keyboard shortcut tables.
- Rewrite the popup help and usage guide in English, documenting current box matching, bulk editing, and frame marking behavior.
- Preserve annotation behavior and shortcut bindings from 1.6.17.

## 1.6.17 - 2026-10-19

- Fix `Ctrl+B` after dragging a body edge: match targets using the geometry before/after the edit and the source layout, instead of left/right order. A missing small box no longer causes a larger box to shrink.
- Add the edited source box if no match exists; otherwise set only the selected edge to the blue line's absolute coordinate. Preserve the other three edges and other objects, and merge matching duplicates.
- Test all four edges, missing boxes, different box orders, nested boxes, repeated copying, and batch undo.

## 1.6.16 - 2026-10-19

- Fix nearly duplicate source body boxes incorrectly protecting old target boxes. Copying groups source duplicates at 75% IoU; red warnings still use 90%.
- Test one source box replacing one or more old boxes of different heights, leaving one copied box at that position and preserving other objects.
- Recheck nested boxes, repeated copying, `Ctrl+C` / `Ctrl+V`, and bulk undo with `Z`.

## 1.6.15 - 2026-10-19

- Fix selected bbox copying with nested boxes: compare the full source layout to preserve enclosing boxes and other objects while replacing a matching narrow box with one copied box.
- Use the same matching for `Ctrl+B` and `Ctrl+C` / `Ctrl+V`. Repeated copies do not add duplicates; `Z` still undoes the whole batch.
- Add tests for nested boxes, size differences, duplicates, and repeated pasting.

## 1.6.14 - 2026-10-19

- Detect the Windows Extension ID in both `Preferences` and `Secure Preferences` for Chrome, Chrome Beta, Chrome Canary, and Chromium.
- If automatic detection is unavailable, prompt the user to copy the ID from `chrome://extensions` and paste it to continue setup.

## 1.6.13 - 2026-10-19

- Add `Install-NOTA-Updater.command` and a universal macOS native updater for Apple Silicon and Intel. After one-time setup, Mac users can use **Update now** as on Windows.
- Show separate Windows and macOS instructions on the updater setup page.

## 1.6.12 - 2026-10-19

- Prevent copying a small nested body box from replacing the enclosing box: matching now also checks width and height similarity while still merging true duplicates.

## 1.6.11 - 2026-10-19

- Identify matching boxes using both IoU and coverage of the smaller box. Replace all matching duplicates at a position with one source box, even when the old box is much taller.

## 1.6.10 - 2026-10-19

- Use a 50% IoU threshold for selected bbox replacement to handle differing heights; keep the red duplicate warning threshold at 90%.

## 1.6.9 - 2026-10-19

- With selected bbox `Ctrl+B` or `Ctrl+C` / `Ctrl+V`, replace target boxes at 90% IoU or above. If none match, add the new box and preserve others.

## 1.6.8 - 2026-10-19

- Fix `Ctrl+B` after drawing an `M` delete region for hand and eye boxes: always open bulk deletion, including when the polygon closes on its first point or the source region contains no boxes.

## 1.6.7 - 2026-10-19

- Show red duplicate warnings only at 90% IoU or above. Small boxes partly overlapping or contained within larger boxes no longer trigger false warnings.

## 1.6.6 - 2026-10-19

- Correct the part frame-count orientation to read from top to bottom.

## 1.6.5 - 2026-10-19

- Change **Selected box only** in `Ctrl+B` to append the box without replacing existing target boxes.
- Highlight overlapping boxes with a red fill and border; show the total bbox count in the image corner.
- Show each part's total frame count in the left sidebar.

## 1.6.4 - 2026-10-19

- Fix the updater reporting the latest version while the popup still shows the old running version.
- Reload whenever files on disk are newer than Chrome's running extension, even if the native updater returns `up_to_date`.

## 1.6.3 - 2026-10-19

- Standardize body/hand/eye box shortcuts: `X` deletes all boxes, `1` / `2` delete left/right, and `Shift+X` deletes all and advances.
- Make `C` and `Shift+C` always copy all boxes from the previously viewed frame. Preserve `Ctrl+C/V`, `V`, `Ctrl+B`, and `Z`.
- Remove the floating shortcut bar at the bottom of the screen.

## 1.6.2 - 2026-10-19

- Apply body edge edits using absolute coordinates: target edges move to the source blue line's position instead of receiving a pixel offset.
- Make the body/hand/eye toolbar buttons clickable while retaining keyboard shortcuts.

## 1.6.1 - 2026-10-19

- Allow selecting one body, hand, or eye box and copying it with `Ctrl+B`. Replace the box at the same left/right rank and preserve other boxes.
- Prefer the selected box for `Ctrl+C` / `Ctrl+V` on labels with multiple boxes.
- Fix bulk bbox deletion from an `M` polygon for previous, next, or marked frames.

## 1.6.0 - 2026-10-19

- Add an always-visible shortcut bar for body, hand, and eye boxes.
- Add `X`, `Shift+X`, `1`, `2`, `C`, `Shift+C`, `Ctrl+C`, `Ctrl+V`, `V`, and `Z` for quick bbox editing.
- Support bulk copying/deletion by frame count, to the clip boundary, or across marked frames.
- Add double-click and drag for one body edge: show the old edge in white and the new edge in blue, and propagate only that edge.
- Undo an entire bbox batch with one `Z`.

## 1.5.9 - 2026-10-19

- Fix NOTA Updater installer encoding on Windows PowerShell 5.1.

## 1.5.8 - 2026-10-19

- Add NOTA Updater for Windows through Chrome Native Messaging.
- After one-time setup, **Update now** downloads a GitHub release, verifies SHA256, replaces files, and reloads the extension.
- Detect the ID associated with the current unpacked folder and restrict the native host to that ID.

## 1.5.7 - 2026-10-19

- Create a bbox with `N`, a click on the first corner, pointer movement without holding a button, and a click on the opposite corner.
- Cancel before the second click with `Esc`.

## 1.5.6 - 2026-10-19

- Add **Check for updates** to the popup.
- Check the Chrome Web Store first, then GitHub releases.
- Automate packaging and releases with GitHub Actions.
- Preserve 1.5.5 features: filtered-list navigation, three clip statuses, bulk actions for all label types, eye 15pt group transforms, bbox `N` / `M`, and CVAT-style image-boundary clipping.
