# Manual testing: 1.6.21

Use this checklist to verify sticky clip controls and image preloading in your DMS environment.

## Install

1. Extract `dist/NOTA_Labeling_Organizer_Extension_v1.6.21.zip`, or use this repository's `extension` folder.
2. In `chrome://extensions`, disable the older Organizer version. Click **Load unpacked** and select the folder containing `manifest.json`.
3. Reload the DMS tab. Open **Labeling**, choose a label, and open a frame.
4. Find **auto_load_img** and **Stop** directly below the part search field.

## Review checklist

- Expand a long clip and scroll down through its frames. Its header (toggle, clip number, and status buttons) should stay directly below the search/image-loading toolbar.
- Collapse the clip using the pinned toggle, then reopen it. Scroll into another expanded clip and confirm that its own header takes over.
- Mark a long clip Done and collapse it while scrolled near its end. Its header must remain visible instead of jumping to a later part. Repeat by collapsing while Done is still saving, and with the following clips already collapsed.
- Resize the sidebar/window and check that the pinned controls do not overlap the toolbar. Use `A` / `D` to reveal frames and confirm they are not hidden behind the pinned controls.
- Click **auto_load_img** in part 1. Confirm the names show parts 1 and 2, and the denominator is their combined frame count.
- Edit labels and use `A`, `D`, or `Space` while loading. The loader must not change the displayed frame or annotation data.
- Leave playback paused. The image count should continue increasing without further input.
- Click **Stop**. The count should stabilize; completed images remain available. Click **auto_load_img** to continue missing images without reloading the completed ones.
- Once the counter says **Ready**, revisit downloaded frames. Network waiting should be reduced; image decoding and other DMS requests can still take time.
- Complete the last unfinished clip in part 1. Once **all frames** are saved as Done, the names change to parts 2 and 3. Part 2's stored images remain; part 3 fills the available slot.
- If earlier frames in part 1 are unfinished, marking just its last clip Done must not advance the pair.
- Repeat with part 2, then test the last part (only one part remains).
- Stop, open a different part, then start. The pair should start at the newly opened part.
- Switch label/session and verify that loading stops and the counter resets.

The existing Done buttons save real DMS status changes; use frames you actually intend to mark Done when checking the automatic transition.

## Automated checks

Run with Python and Playwright/Chromium installed:

```powershell
python tests/test_preload.py
python tests/test_bbox_copy.py
python tests/test_sidebar_scroll.py
```

The image-loading tests use delayed local responses, actual IndexedDB and Chromium image decoding. They cover request limits, cache hits, Stop/resume, part transitions, failed optimistic Done saves, scope changes, failed image retries, quota errors, and integration with the Organizer. When the saved local DMS source is available, the integration check uses its original `getFrame` and `show` implementations.

The sidebar tests use long clips and local status-save responses. They check header position after collapse, successful/failed pending saves, native-style repaints and list rebuilds, keyboard toggles, frame navigation, and closing near the end of the list.
