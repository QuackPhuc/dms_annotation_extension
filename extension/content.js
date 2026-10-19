(() => {
  "use strict";

  const VERSION = "1.6.17";
  const ROOT_ID = "nota-labeling-organizer-v1";
  const STYLE_ID = "nota-labeling-organizer-style-v1";
  const STORAGE_KEY = "nota-labeling-organizer-filter-v1";
  const ALLOWED_ORIGINS = new Set([
    "https://ntt.dev.nota.ai",
    "http://10.169.1.102:8765"
  ]);
  const GENERIC_COPY_LABELS = new Set([
    "body", "head", "face", "nose", "mouth", "eye", "hand",
    "cigarette", "e_cigarette", "phone", "can", "bottle", "face_mask", "face_lmk"
  ]);
  const BBOX_LABELS = new Set([
    "body", "head", "face", "nose", "mouth", "eye", "hand",
    "cigarette", "e_cigarette", "phone", "can", "bottle", "face_mask"
  ]);
  const OBJECT_BBOX_LABELS = new Set(["cigarette", "e_cigarette", "phone", "can", "bottle"]);
  const QUICK_BBOX_LABELS = new Set(["body", "hand", "eye"]);
  const BBOX_OVERLAP_IOU_THRESHOLD = 0.9;
  const BBOX_COPY_DUPLICATE_IOU_THRESHOLD = 0.75;
  const BBOX_COPY_MATCH_IOU_THRESHOLD = 0.5;
  const BBOX_COPY_MATCH_CONTAINMENT_THRESHOLD = 0.75;
  const BBOX_COPY_MATCH_SIZE_THRESHOLD = 0.4;
  const BBOX_COPY_MATCH_NARROW_AXIS_THRESHOLD = 0.25;
  const BBOX_COPY_MATCH_LONG_AXIS_THRESHOLD = 0.6;

  if (!ALLOWED_ORIGINS.has(location.origin) || document.getElementById(ROOT_ID)) return;

  const state = {
    list: null,
    pane: null,
    toolbar: null,
    input: null,
    status: null,
    empty: null,
    observer: null,
    scheduled: false,
    applying: false,
    openClips: new Set(),
    manuallyClosedClips: new Set(),
    operationBusy: false,
    bulkDialog: null,
    bulkContext: null,
    bulkMode: null,
    bulkDirection: "after",
    markedFrames: new Set(),
    markedScope: null,
    bboxMarkedFrames: new Set(),
    bboxMarkedScope: null,
    markedBadge: null,
    manualMode: null,
    lastPatch: null,
    polygonDrawingInstalled: false,
    nativeEditingInstalled: false,
    committingPolygon: false,
    samAcceptHeld: false,
    pointerPerformanceInstalled: false,
    pointerInsideView: false,
    pointerMoveEvent: false,
    pointerMagnifyFrame: 0,
    pointerHover: null,
    zoomPerformanceInstalled: false,
    zoomFrame: 0,
    zoomPending: null,
    sidebarRenderingInstalled: false,
    statusRenderingInstalled: false,
    organizedPlaybackInstalled: false,
    labelVisibilityInstalled: false,
    eyePanelHintInstalled: false,
    eyeGroupDraggingInstalled: false,
    eyeTransformDrawingInstalled: false,
    eyeGroupDrag: null,
    eyeBulkDialog: null,
    eyeBulkContext: null,
    eyeBulkDirection: "after",
    lastCreatedBox: null,
    bboxMode: null,
    bboxCreateDraft: null,
    bboxDeleteRegion: null,
    bboxClipboard: null,
    bboxUndo: [],
    quickFrameCurrent: null,
    quickFramePrevious: null,
    quickLastOperation: null,
    bodyEdgePatch: null,
    renderingSidebar: false,
    sidebarScope: null,
    regionScope: null,
    regionFrame: null,
    frameRegions: new Map(),
    clipRegions: new Map(),
    filter: readStoredFilter()
  };

  function readStoredFilter() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function storeFilter(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {
      // The organizer still works when local storage is unavailable.
    }
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function isLabelingMode() {
    const title = document.getElementById("labTitle");
    if (!state.pane || !title) return false;
    const text = normalize(title.textContent);
    return text.startsWith("labeling") && getComputedStyle(state.pane).display !== "none";
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 6px;
        border-bottom: 1px solid var(--line, #353b45);
        background: var(--panel, #1d2128);
        position: sticky;
        top: 0;
        z-index: 4;
      }
      #${ROOT_ID}[hidden] { display: none !important; }
      #${ROOT_ID} .nl-search-wrap {
        position: relative;
        flex: 1;
        min-width: 0;
      }
      #${ROOT_ID} .nl-search {
        box-sizing: border-box;
        width: 100%;
        height: 32px;
        padding: 5px 30px 5px 9px;
        border: 1px solid #606978;
        border-radius: 5px;
        background: #11141a;
        color: #f4f6fa;
        font: inherit;
        outline: none;
      }
      #${ROOT_ID} .nl-search:focus {
        border-color: #55aaff;
        box-shadow: 0 0 0 2px rgba(85, 170, 255, .2);
      }
      #${ROOT_ID} .nl-clear {
        position: absolute;
        right: 3px;
        top: 3px;
        width: 26px;
        height: 26px;
        border: 0;
        border-radius: 4px;
        color: #c9d1dc;
        background: transparent;
        cursor: pointer;
        font-size: 17px;
        line-height: 24px;
      }
      #${ROOT_ID} .nl-clear:hover { background: #303641; color: #fff; }
      #${ROOT_ID} .nl-status {
        flex: none;
        min-width: 46px;
        color: #aeb9c8;
        font-size: 11px;
        text-align: right;
        white-space: nowrap;
      }
      #labList .nl-organized > .nl-clips {
        flex: 1;
        min-width: 0;
      }
      #labList .nl-organized > .vlab { position: relative; }
      #labList .nl-part-total {
        position: sticky;
        top: 4px;
        display: inline-flex;
        align-items: center;
        margin-top: 7px;
        padding: 5px 2px;
        border: 1px solid #397a9f;
        border-radius: 4px;
        color: #d9f3ff;
        background: #17384c;
        font-size: 10px;
        font-weight: 750;
        line-height: 1;
        white-space: nowrap;
        writing-mode: vertical-rl;
      }
      #labList > .grp[hidden] { display: none !important; }
      #labList .nl-clip {
        border-bottom: 1px solid rgba(255,255,255,.06);
      }
      #labList .nl-clip:last-child { border-bottom: 0; }
      #labList .nl-clip > summary {
        display: flex;
        align-items: center;
        gap: 7px;
        min-height: 30px;
        padding: 4px 7px;
        box-sizing: border-box;
        cursor: pointer;
        user-select: none;
        color: #f1f5f9;
        background: #222832;
        list-style: none;
      }
      #labList .nl-clip > summary::-webkit-details-marker { display: none; }
      #labList .nl-clip > summary::before {
        content: "▶";
        width: 10px;
        flex: none;
        color: #65b5ff;
        font-size: 9px;
        transition: transform .12s ease;
      }
      #labList .nl-clip[open] > summary::before { transform: rotate(90deg); }
      #labList .nl-clip > summary:hover { background: #2a313d; }
      #labList .nl-clip.nl-current > summary {
        background: #29384a;
        box-shadow: inset 3px 0 0 #55aaff;
      }
      #labList .nl-clip-no {
        min-width: 30px;
        color: #fff;
      }
      #labList .nl-clip-meta {
        flex: 1;
        min-width: 0;
        color: #aeb9c8;
        font-size: 11px;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #labList .nl-clip-status-actions {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        flex: none;
      }
      #labList .nl-clip-status-actions button {
        min-height: 24px;
        padding: 2px 5px;
        border: 1px solid #596273;
        border-radius: 4px;
        background: #202630;
        color: #dce4ee;
        font: inherit;
        font-size: 9px;
        font-weight: 650;
        line-height: 1.1;
        white-space: nowrap;
        cursor: pointer;
      }
      #labList .nl-clip-status-actions button:hover:not(:disabled) { background: #303947; }
      #labList .nl-clip-status-actions button[data-state="done"] { border-color: #318f50; color: #8cffaa; }
      #labList .nl-clip-status-actions button[data-state="todo"] { border-color: #788394; color: #d9e0e8; }
      #labList .nl-clip-status-actions button[data-state="wip"] { border-color: #bd7b20; color: #ffc86f; }
      #labList .nl-clip-status-actions button.current { box-shadow: inset 0 0 0 1px currentColor; background: #303947; }
      #labList .nl-clip-status-actions button:disabled { opacity: .42; cursor: default; }
      #labList .nl-clip-status-actions[aria-busy="true"] { opacity: .62; }
      #labList .nl-checkpoint {
        flex: none;
        color: #ffd166;
        font-size: 11px;
        line-height: 1;
      }
      #labList li.nl-marked-frame {
        box-shadow: inset 3px 0 0 #bd76ee;
        background: rgba(116, 64, 161, .28);
      }
      #labList .nl-frame-mark {
        flex: none;
        color: #e3b6ff;
        font-size: 10px;
        font-weight: 700;
      }
      #labList .nl-clip > ul { width: 100%; }
      #labList .nl-empty-filter {
        margin: 10px 7px;
        padding: 10px;
        border: 1px dashed #596273;
        border-radius: 5px;
        color: #bac3cf;
        text-align: center;
        font-size: 12px;
      }
      body.sideMin #${ROOT_ID} { display: none !important; }
      body.sideMin #labList .nl-clip > summary { padding: 3px 4px; min-height: 25px; }
      body.sideMin #labList .nl-clip-meta { display: none; }
      body.sideMin #labList .nl-clip-status-actions { display: none; }

      #nl-polygon-tools {
        margin: 8px 0;
        padding: 7px;
        border: 1px solid #596273;
        border-radius: 5px;
        background: #171b22;
      }
      #nl-polygon-tools .nl-poly-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
      #nl-polygon-tools button {
        padding: 6px 5px;
        border: 1px solid #596273;
        border-radius: 4px;
        color: #dce4ee;
        background: #202630;
        cursor: pointer;
        font-size: 11px;
      }
      #nl-polygon-tools button.on {
        border-color: #b56cff;
        color: #fff;
        background: #543074;
      }
      #nl-polygon-tools button[data-poly="subtract"] { color: #ff9ba4; border-color: #98515a; }
      #nl-polygon-tools button[data-poly="subtract"].on { color: #fff; border-color: #ff4d5a; background: #782b35; }
      #nl-polygon-tools .nl-poly-help { margin-top: 5px; color: #aeb9c8; font-size: 10px; line-height: 1.35; }

      .nl-bulk-dialog {
        width: min(520px, calc(100vw - 28px));
        padding: 0;
        border: 1px solid #8751b3;
        border-radius: 10px;
        color: #f1f3f7;
        background: #1c1e25;
        box-shadow: 0 20px 70px rgba(0,0,0,.55);
      }
      .nl-bulk-dialog::backdrop { background: rgba(0,0,0,.68); }
      .nl-bulk-dialog .nl-modal { padding: 20px; }
      .nl-bulk-dialog h2 { margin: 0 0 5px; font-size: 20px; }
      .nl-bulk-dialog .nl-sub { margin: 0 0 15px; color: #c1c8d2; font-size: 13px; }
      .nl-bulk-dialog .nl-label { display: block; margin: 12px 0 6px; color: #e7eaf0; font-size: 13px; }
      .nl-bulk-dialog .nl-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
      .nl-bulk-dialog .nl-choice button,
      .nl-bulk-dialog .nl-actions button {
        min-height: 38px;
        border: 1px solid #596273;
        border-radius: 6px;
        color: #e9edf3;
        background: #171a20;
        cursor: pointer;
        font-weight: 600;
      }
      .nl-bulk-dialog .nl-choice button.on,
      .nl-bulk-dialog .nl-actions .primary { border-color: #bd76ee; background: #7440a1; color: #fff; }
      .nl-bulk-dialog .nl-scope { display: grid; gap: 6px; padding: 9px; border: 1px solid #414754; border-radius: 6px; }
      .nl-bulk-dialog .nl-scope[hidden], .nl-bulk-dialog .nl-label[hidden],
      .nl-bulk-dialog .nl-choice button[hidden] { display: none !important; }
      .nl-bulk-dialog .nl-scope label { display: flex; gap: 7px; align-items: flex-start; font-size: 12px; }
      .nl-bulk-dialog .nl-scope label[hidden] { display: none !important; }
      .nl-bulk-dialog .nl-mask-only[hidden] { display: none !important; }
      .nl-bulk-dialog .nl-count {
        box-sizing: border-box;
        width: 100%;
        height: 40px;
        padding: 7px 10px;
        border: 1px solid #687181;
        border-radius: 6px;
        color: #fff;
        background: #101319;
        font: inherit;
      }
      .nl-bulk-dialog .nl-preview { margin-top: 10px; padding: 10px; border-radius: 6px; color: #ddd5e6; background: #2b2235; font-size: 12px; line-height: 1.45; }
      .nl-bulk-dialog .nl-preview.err { color: #ffb4b4; background: #3a2024; }
      .nl-bulk-dialog .nl-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 15px; }
      .nl-bulk-dialog .nl-actions button { min-width: 100px; padding: 0 12px; }
      .nl-bulk-dialog button:disabled { opacity: .5; cursor: default; }
      .nl-bulk-dialog.nl-subtract h2 { color: #ff9ba4; }
      .nl-bulk-dialog.nl-subtract .nl-preview { color: #ffd8dc; background: #3d252d; }
      .nl-bulk-dialog.nl-subtract .nl-actions .primary { border-color: #ff6b78; background: #9b3542; }
      .nl-bulk-dialog.nl-status-mode h2 { color: #e3b6ff; }
      .nl-bulk-dialog.nl-status-mode .nl-actions .primary { border-color: #bd76ee; background: #7440a1; }

      #nl-marked-frames {
        position: fixed;
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 5px 8px;
        border: 1px solid #8751b3;
        border-radius: 6px;
        color: #f1e8f7;
        background: rgba(31, 25, 39, .94);
        box-shadow: 0 5px 18px rgba(0,0,0,.35);
        font-size: 12px;
        pointer-events: none;
      }
      #nl-marked-frames[hidden] { display: none !important; }
      #nl-marked-frames .nl-mark-box {
        display: inline-grid;
        place-items: center;
        width: 15px;
        height: 15px;
        border: 1px solid #c6a0df;
        border-radius: 2px;
        color: #fff;
        background: #7440a1;
        font-size: 11px;
      }
      #nl-marked-frames[data-count="0"] .nl-mark-box { color: transparent; background: transparent; }
      #nl-marked-frames button {
        padding: 3px 7px;
        border: 1px solid #65566f;
        border-radius: 4px;
        color: #eee7f3;
        background: #31293a;
        cursor: pointer;
        font: inherit;
        pointer-events: auto;
      }
      #nl-marked-frames button[hidden] { display: none; }
      .nl-eye-group-hint {
        margin-top: 7px;
        padding: 7px 8px;
        border: 1px solid #4b5667;
        border-radius: 5px;
        color: #d7dce5;
        background: #242a33;
        font-size: 11px;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }

  function buildToolbar() {
    const toolbar = document.createElement("div");
    toolbar.id = ROOT_ID;
    toolbar.dataset.version = VERSION;
    toolbar.innerHTML = `
      <div class="nl-search-wrap">
        <input class="nl-search" type="search" autocomplete="off" spellcheck="false"
          aria-label="Tìm part" placeholder="Tìm part, ví dụ: ciga">
        <button class="nl-clear" type="button" title="Xóa từ khóa" aria-label="Xóa từ khóa">×</button>
      </div>
      <span class="nl-status" aria-live="polite"></span>
    `;

    state.input = toolbar.querySelector(".nl-search");
    state.status = toolbar.querySelector(".nl-status");
    state.input.value = state.filter;

    state.input.addEventListener("input", () => {
      state.filter = state.input.value;
      storeFilter(state.filter);
      applyFilter();
    });

    state.input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.input.value) {
        event.preventDefault();
        state.input.value = "";
        state.input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    toolbar.querySelector(".nl-clear").addEventListener("click", () => {
      state.input.value = "";
      state.input.dispatchEvent(new Event("input", { bubbles: true }));
      state.input.focus();
    });

    return toolbar;
  }

  function clipKey(partName, clipNo) {
    return `${partName}\u001f${clipNo}`;
  }

  function getClipNo(li) {
    return (li.querySelector(".no")?.textContent || "Không rõ clip").trim();
  }

  function getMeta(items) {
    const total = items.length;
    let done = 0;
    let doing = 0;
    let checkpoint = -1;
    for (let index = 0; index < items.length; index += 1) {
      const li = items[index];
      const status = li.querySelector(".fs");
      if (status?.classList.contains("done")) {
        done += 1;
        checkpoint = index;
      } else if (status?.classList.contains("wip")) {
        doing += 1;
        checkpoint = index;
      }
    }
    const pieces = [`${total} ảnh`];
    if (done) pieces.push(`${done} xong`);
    if (doing) pieces.push(`${doing} đang làm`);
    if (checkpoint >= 0) pieces.push(`📍 ${checkpoint + 1}/${total}`);
    return { total, done, doing, checkpoint, text: pieces.join(" · ") };
  }

  function pageLabelingReady(label = null) {
    try {
      return isLabelingMode() && typeof S !== "undefined" && S.mode === "label" && !!S.sess &&
        (!label || S.labelSel === label);
    } catch (_) {
      return false;
    }
  }

  function quickBboxReady() {
    try {
      return QUICK_BBOX_LABELS.has(S.labelSel) && pageLabelingReady(S.labelSel);
    } catch (_) {
      return false;
    }
  }

  function organizedNavigationRows() {
    if (!state.list) return [];
    const allRows = Array.from(state.list.querySelectorAll(".grp.nl-organized li[data-g]"));
    if (!allRows.length) return [];
    const visibleRows = Array.from(state.list.querySelectorAll(".grp.nl-organized:not([hidden]) li[data-g]"));
    const active = Number.isInteger(S.g) && allRows.some((li) => Number(li.dataset.g) === S.g)
      ? S.g
      : S.shownG;
    return visibleRows.some((li) => Number(li.dataset.g) === active) ? visibleRows : allRows;
  }

  function navigateOrganizedFrames(direction, amount = 1) {
    if (!pageLabelingReady() || typeof show !== "function") return false;
    const rows = organizedNavigationRows();
    if (!rows.length) return false;
    const active = Number.isInteger(S.g) && rows.some((li) => Number(li.dataset.g) === S.g)
      ? S.g
      : S.shownG;
    const index = rows.findIndex((li) => Number(li.dataset.g) === active);
    if (index < 0) return false;
    const nextIndex = Math.max(0, Math.min(rows.length - 1, index + Math.sign(direction) * Math.max(1, amount)));
    if (nextIndex === index) return true;
    const next = Number(rows[nextIndex].dataset.g);
    if (!Number.isInteger(next)) return false;
    try { if (typeof pause === "function") pause(); } catch (_) {}
    show(next);
    return true;
  }

  function ensureOrganizedPlayback() {
    if (state.organizedPlaybackInstalled || typeof playNext !== "function") return;
    const nativePlayNext = playNext;
    playNext = function (g, step = 1) {
      if (!pageLabelingReady()) return nativePlayNext.apply(this, arguments);
      const rows = organizedNavigationRows();
      if (!rows.length) return nativePlayNext.apply(this, arguments);
      const index = rows.findIndex((li) => Number(li.dataset.g) === g);
      if (index < 0) return nativePlayNext.apply(this, arguments);
      const distance = Math.max(1, Math.abs(Number(step) || 1));
      const nextIndex = Math.min(rows.length - 1, index + distance);
      const next = Number(rows[nextIndex].dataset.g);
      return Number.isInteger(next) ? next : nativePlayNext.apply(this, arguments);
    };
    state.organizedPlaybackInstalled = true;
  }

  function eyeLandmarkActive() {
    try {
      return pageLabelingReady("eye_lmk") && typeof lmkActive === "function" && lmkActive();
    } catch (_) {
      return false;
    }
  }

  function drawBboxOverlapWarnings() {
    const canvas = document.getElementById("view");
    if (!canvas) return;
    if (!bboxLabelingReady() || typeof S === "undefined" || S.showAl === false ||
        typeof ED === "undefined" || !Array.isArray(ED.items) || typeof ctx === "undefined") {
      delete canvas.dataset.nlBboxCount;
      delete canvas.dataset.nlBboxOverlap;
      return;
    }

    const boxes = ED.items.map((item, index) => {
      if (!Array.isArray(item?.box) || item.box.length < 4) return null;
      const values = item.box.slice(0, 4).map(Number);
      if (!values.every(Number.isFinite)) return null;
      return {
        index,
        box: [Math.min(values[0], values[2]), Math.min(values[1], values[3]),
          Math.max(values[0], values[2]), Math.max(values[1], values[3])]
      };
    }).filter(Boolean);
    const overlapping = new Set();
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        if (bboxIntersectionOverUnion(boxes[left].box, boxes[right].box) >= BBOX_OVERLAP_IOU_THRESHOLD) {
          overlapping.add(boxes[left].index);
          overlapping.add(boxes[right].index);
        }
      }
    }

    canvas.dataset.nlBboxCount = String(boxes.length);
    canvas.dataset.nlBboxOverlap = String(overlapping.size);
    const scale = canvas.width / (Number(S.sess?.src_w) || canvas.width || 1);
    const rect = canvas.getBoundingClientRect();
    const k = typeof pxK === "function" ? pxK() : canvas.width / (rect.width || canvas.width || 1);
    ctx.save();
    ctx.setLineDash([]);
    for (const entry of boxes) {
      if (!overlapping.has(entry.index)) continue;
      const [x1, y1, x2, y2] = entry.box.map((value) => value * scale);
      ctx.fillStyle = "rgba(255, 38, 64, .16)";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = "#ff263f";
      ctx.lineWidth = 3 * k;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    const text = `BBox: ${boxes.length}`;
    ctx.font = `700 ${Math.round(14 * k)}px Consolas, monospace`;
    ctx.textBaseline = "top";
    const paddingX = 8 * k;
    const paddingY = 5 * k;
    const width = ctx.measureText(text).width + paddingX * 2;
    const height = 14 * k + paddingY * 2;
    const x = Math.max(4 * k, canvas.width - width - 8 * k);
    const y = 8 * k;
    ctx.fillStyle = overlapping.size ? "rgba(176, 0, 28, .92)" : "rgba(18, 24, 32, .86)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = overlapping.size ? "#ff5268" : "#70c8ff";
    ctx.lineWidth = 1.5 * k;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x + paddingX, y + paddingY);
    ctx.restore();
  }

  function ensureLabelVisibility() {
    if (state.labelVisibilityInstalled || typeof edDraw !== "function") return;
    const nativeDraw = edDraw;
    edDraw = function (...args) {
      // K toggles S.showAl on the original page. Eye landmarks are drawn by
      // edDraw separately from auto-labels, so honor K while In progress too.
      if (pageLabelingReady("eye_lmk") && typeof S !== "undefined" && S.showAl === false) {
        try { if (typeof edMagnify === "function") edMagnify(); } catch (_) {}
        return;
      }
      // Bbox M uses the same red deletion-region presentation as seatbelt M.
      // Hide the editor's native grey dashed polygon while drawing, then
      // restore its points because they are still used for input handling.
      const bboxDelete = state.bboxMode === "delete" && bboxLabelingReady() &&
        typeof ED !== "undefined" && Array.isArray(ED.poly);
      const polygonKey = bboxDelete ? ED.key : null;
      const polygon = bboxDelete ? ED.poly : null;
      if (bboxDelete) ED.poly = [];
      let result;
      try {
        result = nativeDraw.apply(this, args);
      } finally {
        if (bboxDelete && ED.key === polygonKey) ED.poly = polygon;
      }
      drawBboxDeletePolygon();
      drawBboxOverlapWarnings();
      drawBodyEdgePatch();
      return result;
    };
    state.labelVisibilityInstalled = true;
  }

  function eyeSelectionGeometry(event = null) {
    if (!eyeLandmarkActive() || S.showAl === false || typeof LM === "undefined" ||
        typeof lmkCur !== "function" || typeof view === "undefined" || !view) return null;
    const items = lmkCur();
    const item = items?.[LM.n];
    const points = item?.pts?.filter((point) => Array.isArray(point));
    if (!points?.length) return null;
    const rect = view.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scale = view.width / S.sess.src_w;
    const k = typeof pxK === "function" ? pxK() : view.width / rect.width;
    const bounds = [
      Math.min(...points.map((point) => point[0])),
      Math.min(...points.map((point) => point[1])),
      Math.max(...points.map((point) => point[0])),
      Math.max(...points.map((point) => point[1]))
    ];
    const padding = 14 * k;
    const display = [bounds[0] * scale - padding, bounds[1] * scale - padding,
      bounds[2] * scale + padding, bounds[3] * scale + padding];
    const [x1, y1, x2, y2] = display;
    const handles = [
      { key: "nw", x: x1, y: y1, cursor: "nwse-resize" },
      { key: "ne", x: x2, y: y1, cursor: "nesw-resize" },
      { key: "se", x: x2, y: y2, cursor: "nwse-resize" },
      { key: "sw", x: x1, y: y2, cursor: "nesw-resize" },
      { key: "n", x: (x1 + x2) / 2, y: y1, cursor: "ns-resize" },
      { key: "s", x: (x1 + x2) / 2, y: y2, cursor: "ns-resize" },
      { key: "w", x: x1, y: (y1 + y2) / 2, cursor: "ew-resize" },
      { key: "e", x: x2, y: (y1 + y2) / 2, cursor: "ew-resize" }
    ];
    const canvasPoint = event ? [
      (event.clientX - rect.left) * view.width / rect.width,
      (event.clientY - rect.top) * view.height / rect.height
    ] : null;
    return { item, points, rect, scale, k, bounds, display, handles, canvasPoint };
  }

  function eyeResizeAtEvent(event) {
    const geometry = eyeSelectionGeometry(event);
    if (!geometry) return null;
    const tolerance = 7 * geometry.k;
    const handle = geometry.handles.find((candidate) =>
      Math.abs(candidate.x - geometry.canvasPoint[0]) <= tolerance &&
      Math.abs(candidate.y - geometry.canvasPoint[1]) <= tolerance);
    if (!handle) return null;
    return {
      ...geometry,
      handle: handle.key,
      cursor: handle.cursor,
      paddingSource: 14 * geometry.k / geometry.scale,
      start: [geometry.canvasPoint[0] / geometry.scale, geometry.canvasPoint[1] / geometry.scale],
      original: geometry.item.pts.map((point) => Array.isArray(point) ? point.slice() : null),
      moved: false
    };
  }

  function eyeGroupAtEvent(event, allowPoint = false) {
    const geometry = eyeSelectionGeometry(event);
    if (!geometry) return null;
    const { item, points, scale, k, display, canvasPoint } = geometry;
    const hitTolerance = 10 * k;
    const hitsPoint = points.some((point) =>
      Math.hypot(point[0] * scale - canvasPoint[0], point[1] * scale - canvasPoint[1]) <= hitTolerance);
    if (hitsPoint && !allowPoint) return null;
    if (canvasPoint[0] < display[0] || canvasPoint[0] > display[2] ||
        canvasPoint[1] < display[1] || canvasPoint[1] > display[3]) return null;
    return {
      item,
      bounds: geometry.bounds,
      paddingSource: 14 * k / scale,
      start: [canvasPoint[0] / scale, canvasPoint[1] / scale],
      original: item.pts.map((point) => Array.isArray(point) ? point.slice() : null),
      moved: false
    };
  }

  function onEyeGroupMouseDown(event) {
    if (event.button !== 0 || event.metaKey || event.altKey || event.shiftKey || state.eyeGroupDrag) return;
    const resize = event.ctrlKey ? null : eyeResizeAtEvent(event);
    const drag = resize || eyeGroupAtEvent(event, event.ctrlKey);
    if (!drag) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    drag.mode = resize ? "resize" : event.ctrlKey ? "rotate" : "move";
    if (drag.mode === "rotate") {
      const points = drag.original.filter((point) => Array.isArray(point));
      drag.center = [
        points.reduce((sum, point) => sum + point[0], 0) / points.length,
        points.reduce((sum, point) => sum + point[1], 0) / points.length
      ];
      drag.startAngle = Math.atan2(drag.start[1] - drag.center[1], drag.start[0] - drag.center[0]);
    }
    state.eyeGroupDrag = drag;
    try { if (typeof pause === "function") pause(); } catch (_) {}
    try { view.style.cursor = drag.cursor || "grabbing"; } catch (_) {}
    if (drag.mode === "rotate") notify("Đang xoay cả cụm eye 15pt");
  }

  function onEyeGroupMouseMove(event) {
    const drag = state.eyeGroupDrag;
    if (!drag || typeof view === "undefined" || !view) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const rect = view.getBoundingClientRect();
    const scale = view.width / S.sess.src_w;
    const current = [
      (event.clientX - rect.left) * view.width / rect.width / scale,
      (event.clientY - rect.top) * view.height / rect.height / scale
    ];
    const round = (value) => Math.round(value * 10) / 10;
    if (drag.mode === "rotate") {
      const angle = Math.atan2(current[1] - drag.center[1], current[0] - drag.center[0]) - drag.startAngle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      drag.item.pts = drag.original.map((point) => point ? [
        round(drag.center[0] + (point[0] - drag.center[0]) * cos - (point[1] - drag.center[1]) * sin),
        round(drag.center[1] + (point[0] - drag.center[0]) * sin + (point[1] - drag.center[1]) * cos)
      ] : null);
      drag.moved = drag.moved || Math.abs(angle) >= 0.001;
    } else if (drag.mode === "resize") {
      const [left, top, right, bottom] = drag.bounds;
      const next = [left, top, right, bottom];
      const pad = drag.paddingSource;
      const minSize = 2;
      if (drag.handle.includes("w")) next[0] = Math.min(right - minSize, current[0] + pad);
      if (drag.handle.includes("e")) next[2] = Math.max(left + minSize, current[0] - pad);
      if (drag.handle.includes("n")) next[1] = Math.min(bottom - minSize, current[1] + pad);
      if (drag.handle.includes("s")) next[3] = Math.max(top + minSize, current[1] - pad);
      const scaleX = (next[2] - next[0]) / Math.max(minSize, right - left);
      const scaleY = (next[3] - next[1]) / Math.max(minSize, bottom - top);
      drag.item.pts = drag.original.map((point) => point ? [
        round(next[0] + (point[0] - left) * scaleX),
        round(next[1] + (point[1] - top) * scaleY)
      ] : null);
      drag.moved = drag.moved || next.some((value, index) => Math.abs(value - drag.bounds[index]) >= 0.05);
    } else {
      const dx = current[0] - drag.start[0];
      const dy = current[1] - drag.start[1];
      drag.item.pts = drag.original.map((point) => point ? [round(point[0] + dx), round(point[1] + dy)] : null);
      drag.moved = drag.moved || Math.abs(dx) >= 0.05 || Math.abs(dy) >= 0.05;
    }
    try { LM.sig = null; } catch (_) {}
    try { if (typeof edRepaint === "function") edRepaint(); } catch (_) {}
  }

  function onEyeTransformHover(event) {
    if (state.eyeGroupDrag || !eyeLandmarkActive() || S.showAl === false) return;
    const resize = eyeResizeAtEvent(event);
    if (resize && !event.ctrlKey) {
      view.style.cursor = resize.cursor;
      return;
    }
    const group = eyeGroupAtEvent(event, event.ctrlKey);
    if (group) view.style.cursor = event.ctrlKey ? "crosshair" : "grab";
  }

  function onEyeGroupMouseUp(event) {
    const drag = state.eyeGroupDrag;
    if (!drag) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.eyeGroupDrag = null;
    try { view.style.cursor = ""; } catch (_) {}
    if (drag.moved) {
      try { if (typeof lmkChanged === "function") lmkChanged(); } catch (_) {}
    }
  }

  function ensureEyeGroupDragging() {
    if (state.eyeGroupDraggingInstalled || typeof view === "undefined" || !view) return;
    window.addEventListener("mousedown", onEyeGroupMouseDown, true);
    window.addEventListener("mousemove", onEyeGroupMouseMove, true);
    window.addEventListener("mouseup", onEyeGroupMouseUp, true);
    view.addEventListener("mousemove", onEyeTransformHover);
    state.eyeGroupDraggingInstalled = true;
  }

  function drawEyeTransformBox() {
    const geometry = eyeSelectionGeometry();
    if (!geometry || typeof ctx === "undefined") return;
    const [x1, y1, x2, y2] = geometry.display;
    const size = 7 * geometry.k;
    ctx.save();
    ctx.setLineDash([4 * geometry.k, 3 * geometry.k]);
    ctx.strokeStyle = "#ffea00";
    ctx.lineWidth = 1.2 * geometry.k;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.setLineDash([]);
    for (const handle of geometry.handles) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = geometry.k;
      ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
    }
    ctx.restore();
  }

  function ensureEyeTransformDrawing() {
    if (state.eyeTransformDrawingInstalled || typeof lmkDraw !== "function") return;
    const nativeDraw = lmkDraw;
    lmkDraw = function (...args) {
      const result = nativeDraw.apply(this, args);
      if (eyeLandmarkActive() && S.showAl !== false) drawEyeTransformBox();
      return result;
    };
    state.eyeTransformDrawingInstalled = true;
  }

  function ensureEyePanelHint() {
    if (state.eyePanelHintInstalled || typeof lmkPanel !== "function") return;
    const nativePanel = lmkPanel;
    lmkPanel = function (...args) {
      const result = nativePanel.apply(this, args);
      if (pageLabelingReady("eye_lmk")) {
        const panel = document.getElementById("lmkRef");
        if (panel && !panel.querySelector(".nl-eye-group-hint")) {
          const hint = document.createElement("div");
          hint.className = "nl-eye-group-hint";
          hint.innerHTML = "Kéo trong khung: di chuyển cả mắt · <b>Ctrl + kéo</b>: xoay<br>Kéo ô vuông ở cạnh/góc: co giãn cả mắt";
          panel.appendChild(hint);
        }
      }
      return result;
    };
    state.eyePanelHintInstalled = true;
  }

  function pointerGestureActive() {
    try {
      return Boolean(state.manualMode || state.bboxMode || state.eyeGroupDrag ||
        (typeof VZ !== "undefined" && VZ.pan) ||
        (typeof ED !== "undefined" && (ED.drag || ED.marq || ED.poly?.length)) ||
        (typeof BT !== "undefined" && (BT.drag || BT.poly?.length)) ||
        (typeof LM !== "undefined" && (LM.drag || LM.marq || LM.poly?.length)));
    } catch (_) {
      return false;
    }
  }

  function pointerHoverSignature() {
    try {
      if (typeof beltActive === "function" && beltActive() && typeof BT !== "undefined") return `belt:${BT.hov ?? -1}`;
      if (typeof ED !== "undefined" && ED.hover) return `box:${ED.hover.n}:${ED.hover.corner}`;
    } catch (_) {}
    return "none";
  }

  function useNativePointerCursor() {
    const canvas = document.getElementById("view");
    if (!canvas || !isLabelingMode() || pointerGestureActive()) return;
    try {
      if (typeof beltActive === "function" && beltActive() && typeof BT !== "undefined" && BT.hov >= 0) {
        const cursors = ["nwse-resize", "nesw-resize", "nesw-resize", "nwse-resize",
          "ns-resize", "ns-resize", "ew-resize", "ew-resize"];
        canvas.style.cursor = cursors[BT.hov] || "crosshair";
        return;
      }
    } catch (_) {}
    if (canvas.style.cursor === "none" || !canvas.style.cursor) canvas.style.cursor = "crosshair";
  }

  function schedulePointerMagnifier() {
    if (state.pointerMagnifyFrame) return;
    state.pointerMagnifyFrame = requestAnimationFrame(() => {
      state.pointerMagnifyFrame = 0;
      try { if (state.pointerInsideView && typeof edMagnify === "function") edMagnify(); } catch (_) {}
    });
  }

  function ensurePointerPerformance() {
    if (state.pointerPerformanceInstalled || typeof paint !== "function" || typeof edRepaint !== "function") return;
    const canvas = document.getElementById("view");
    if (!canvas) return;
    const nativePaint = paint;
    const nativeRepaint = edRepaint;

    try {
      paint = function (...args) {
        const passivePointer = state.pointerInsideView && isLabelingMode() &&
          !pointerGestureActive() && typeof ED !== "undefined";
        if (!passivePointer) return nativePaint.apply(this, args);
        const mouse = ED.mouse;
        ED.mouse = null;
        let result;
        try {
          result = nativePaint.apply(this, args);
        } finally {
          ED.mouse = mouse;
        }
        try { if (mouse && typeof edMagnify === "function") edMagnify(); } catch (_) {}
        useNativePointerCursor();
        return result;
      };
      edRepaint = function (...args) {
        if (state.pointerMoveEvent && state.pointerInsideView && isLabelingMode() && !pointerGestureActive()) {
          const hover = pointerHoverSignature();
          const hoverChanged = hover !== state.pointerHover;
          state.pointerHover = hover;
          useNativePointerCursor();
          schedulePointerMagnifier();
          if (!hoverChanged) return;
        }
        return nativeRepaint.apply(this, args);
      };
    } catch (_) {
      return;
    }

    window.addEventListener("mousemove", (event) => {
      if (event.target !== canvas) return;
      state.pointerInsideView = true;
      state.pointerMoveEvent = true;
      setTimeout(() => { state.pointerMoveEvent = false; }, 0);
    }, true);
    canvas.addEventListener("mouseenter", () => {
      state.pointerInsideView = true;
      state.pointerHover = null;
      useNativePointerCursor();
    }, true);
    window.addEventListener("mouseleave", (event) => {
      if (event.target !== canvas) return;
      state.pointerInsideView = false;
      state.pointerMoveEvent = false;
      state.pointerHover = null;
    }, true);
    state.pointerPerformanceInstalled = true;
  }

  function ensureZoomPerformance() {
    if (state.zoomPerformanceInstalled || typeof paint !== "function" || typeof VZ === "undefined") return;
    const stage = document.getElementById("stage");
    const canvas = document.getElementById("view");
    if (!stage || !canvas) return;

    window.addEventListener("wheel", (event) => {
      if (!isLabelingMode() || !stage.contains(event.target) || !event.deltaY) return;
      try {
        if (typeof S === "undefined" || !S.sess) return;
      } catch (_) {
        return;
      }

      // The original page transforms the image for every wheel event, while
      // masks and boxes are painted on a separate canvas on the next frame.
      // Coalesce rapid wheel events so both layers change in the same frame.
      event.preventDefault();
      event.stopImmediatePropagation();

      let pending = state.zoomPending;
      if (!pending || pending.canvas !== canvas || !canvas.isConnected) {
        const rect = canvas.getBoundingClientRect();
        pending = {
          canvas,
          baseLeft: rect.left - (Number(VZ.tx) || 0),
          baseTop: rect.top - (Number(VZ.ty) || 0),
          z: Number(VZ.z) || 1,
          tx: Number(VZ.tx) || 0,
          ty: Number(VZ.ty) || 0
        };
      }

      const unitX = (event.clientX - pending.baseLeft - pending.tx) / pending.z;
      const unitY = (event.clientY - pending.baseTop - pending.ty) / pending.z;
      const nextZoom = Math.max(1, Math.min(8, pending.z * (event.deltaY < 0 ? 1.2 : 1 / 1.2)));
      pending.tx = event.clientX - pending.baseLeft - nextZoom * unitX;
      pending.ty = event.clientY - pending.baseTop - nextZoom * unitY;
      pending.z = nextZoom;
      if (nextZoom === 1) pending.tx = pending.ty = 0;
      state.zoomPending = pending;

      if (state.zoomFrame) return;
      state.zoomFrame = requestAnimationFrame(() => {
        state.zoomFrame = 0;
        const update = state.zoomPending;
        state.zoomPending = null;
        if (!update || !update.canvas.isConnected) return;

        VZ.z = update.z;
        VZ.tx = update.tx;
        VZ.ty = update.ty;
        update.canvas.style.transformOrigin = "0 0";
        update.canvas.style.transform = update.z === 1 && !update.tx && !update.ty
          ? ""
          : `translate(${update.tx}px, ${update.ty}px) scale(${update.z})`;

        // Paint synchronously inside this animation frame. Calling edRepaint
        // here would defer the overlay once more and recreate the short flash.
        try { paint(); } catch (_) {
          try { if (typeof edRepaint === "function") edRepaint(); } catch (_) {}
        }
        try { if (typeof lsTouch === "function") lsTouch(); } catch (_) {}
      });
    }, { capture: true, passive: false });

    state.zoomPerformanceInstalled = true;
  }

  function frameState(g) {
    try {
      if (typeof fsGet === "function") return fsGet(g);
    } catch (_) {}
    const li = state.list?.querySelector(`li[data-g="${g}"]`);
    const fs = li?.querySelector(".fs");
    return fs?.classList.contains("done") ? "done" : fs?.classList.contains("wip") ? "wip" : "todo";
  }

  function markedScopeMatches() {
    return Boolean(state.markedScope && pageLabelingReady() &&
      state.markedScope.generation === S.gen && state.markedScope.session === S.sess &&
      state.markedScope.label === S.labelSel);
  }

  function bboxMarkedScopeMatches() {
    return Boolean(state.bboxMarkedScope && quickBboxReady() &&
      state.bboxMarkedScope.generation === S.gen && state.bboxMarkedScope.session === S.sess &&
      state.bboxMarkedScope.label === S.labelSel);
  }

  function syncMarkedScope() {
    if (!pageLabelingReady()) return false;
    if (!markedScopeMatches()) {
      state.markedFrames.clear();
      state.markedScope = { generation: S.gen, session: S.sess, label: S.labelSel };
    }
    return true;
  }

  function syncBboxMarkedScope() {
    if (!quickBboxReady()) return false;
    if (!bboxMarkedScopeMatches()) {
      state.bboxMarkedFrames.clear();
      state.bboxMarkedScope = { generation: S.gen, session: S.sess, label: S.labelSel };
    }
    return true;
  }

  function positionMarkedBadge() {
    if (!state.markedBadge || state.markedBadge.hidden) return;
    const canvas = document.getElementById("view");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    state.markedBadge.style.left = `${Math.max(8, rect.left + 12)}px`;
    state.markedBadge.style.top = `${Math.max(8, rect.top + 12)}px`;
  }

  function updateMarkedUI() {
    const bboxMode = quickBboxReady();
    const ready = bboxMode ? syncBboxMarkedScope() : syncMarkedScope();
    if (!ready) {
      if (state.markedBadge) state.markedBadge.hidden = true;
      return;
    }
    const selectedFrames = bboxMode ? state.bboxMarkedFrames : state.markedFrames;
    if (!bboxMode) {
      for (const g of Array.from(selectedFrames)) {
        if (frameState(g) !== "done") selectedFrames.delete(g);
      }
    }
    for (const li of state.list?.querySelectorAll("li[data-g]") || []) {
      const selected = selectedFrames.has(Number(li.dataset.g));
      li.classList.toggle("nl-marked-frame", selected);
      let marker = li.querySelector(":scope > .nl-frame-mark");
      if (selected && !marker) {
        marker = document.createElement("span");
        marker.className = "nl-frame-mark";
        marker.textContent = bboxMode ? "◆ V" : "✓ V";
        marker.title = "Frame đã được chọn bằng V";
        const name = li.querySelector(".name");
        if (name) name.before(marker); else li.prepend(marker);
      } else if (!selected) marker?.remove();
    }
    if (!state.markedBadge) return;
    const count = selectedFrames.size;
    state.markedBadge.hidden = false;
    state.markedBadge.dataset.count = String(count);
    state.markedBadge.querySelector("b").textContent = bboxMode
      ? `Đã đánh dấu ${count} frame ${S.labelSel} · V`
      : `Đã chọn ${count} · V`;
    state.markedBadge.querySelector("button").hidden = count === 0;
    positionMarkedBadge();
  }

  function clearMarkedFrames() {
    if (quickBboxReady()) state.bboxMarkedFrames.clear();
    else state.markedFrames.clear();
    updateMarkedUI();
  }

  function toggleMarkedFrame() {
    const bboxMode = quickBboxReady();
    if (state.operationBusy || anyBulkDialogOpen() ||
        !(bboxMode ? syncBboxMarkedScope() : syncMarkedScope())) return;
    const g = Number(S.shownG);
    if (!Number.isInteger(g) || !S.lseq?.includes(g)) return;
    const selectedFrames = bboxMode ? state.bboxMarkedFrames : state.markedFrames;
    if (selectedFrames.has(g)) {
      selectedFrames.delete(g);
      updateMarkedUI();
      notify(`Đã bỏ đánh dấu frame hiện tại · còn ${selectedFrames.size} frame`);
      return;
    }
    if (!bboxMode && frameState(g) !== "done") {
      notify("Chỉ cần chọn frame đang Done; frame hiện tại đã có thể sửa");
      return;
    }
    selectedFrames.add(g);
    updateMarkedUI();
    notify(bboxMode
      ? `Đã đánh dấu ${selectedFrames.size} frame · Ctrl+B để áp dụng thao tác bbox gần nhất`
      : `Đã chọn ${selectedFrames.size} frame · Ctrl+B để chuyển sang In progress`);
  }

  function buildMarkedBadge() {
    const badge = document.createElement("div");
    badge.id = "nl-marked-frames";
    badge.dataset.count = "0";
    badge.innerHTML = `<span class="nl-mark-box">✓</span><b>Đã chọn 0 · V</b><button type="button" hidden>Bỏ chọn tất cả</button>`;
    badge.querySelector("button").addEventListener("click", clearMarkedFrames);
    document.body.appendChild(badge);
    state.markedBadge = badge;
  }

  function captureSidebarPosition() {
    if (!pageLabelingReady() || state.sidebarScope?.generation !== S.gen ||
        state.sidebarScope?.label !== S.labelSel) return null;
    const current = state.list.querySelector("li.cur");
    if (!current || Number(current.dataset.g) !== S.shownG) return null;
    const pane = state.pane;
    const bounds = pane.getBoundingClientRect();
    const row = current.getBoundingClientRect();
    return {
      pane, generation: S.gen, label: S.labelSel, frame: S.shownG,
      top: pane.scrollTop, left: pane.scrollLeft,
      offset: row.height > 0 && row.bottom > bounds.top && row.top < bounds.bottom
        ? row.top - bounds.top : null
    };
  }

  function restoreSidebarPosition(position) {
    if (!position || !pageLabelingReady() || position.pane !== state.pane ||
        position.generation !== S.gen || position.label !== S.labelSel || position.frame !== S.shownG) return;
    const current = state.list.querySelector("li.cur");
    if (!current || Number(current.dataset.g) !== position.frame) return;
    const row = current.getBoundingClientRect();
    state.pane.scrollLeft = position.left;
    state.pane.scrollTop = position.offset !== null && row.height > 0
      ? state.pane.scrollTop + row.top - state.pane.getBoundingClientRect().top - position.offset
      : position.top;
  }

  function revealCurrentFrame() {
    ensureCurrentClipOpen();
    state.list.querySelector("li.cur")?.scrollIntoView({ block: "nearest" });
  }

  function ensureSidebarRendering() {
    if (state.sidebarRenderingInstalled || typeof renderLabList !== "function" ||
        typeof rvMarkLab !== "function") return;
    const nativeRender = renderLabList;
    renderLabList = function (...args) {
      if (state.renderingSidebar) return nativeRender.apply(this, args);
      const position = captureSidebarPosition();
      state.renderingSidebar = true;
      let result;
      try {
        result = nativeRender.apply(this, args);
      } finally {
        state.renderingSidebar = false;
        if (pageLabelingReady()) {
          // Reapply grouping/filtering before restoring scroll. The native
          // flat list has a different height and can clamp scrollTop to zero.
          enhance();
          if (position) restoreSidebarPosition(position);
          else revealCurrentFrame();
        }
      }
      return result;
    };
    const nativeMark = rvMarkLab;
    rvMarkLab = function (...args) {
      const position = state.renderingSidebar ? null : captureSidebarPosition();
      const result = nativeMark.apply(this, args);
      if (!state.renderingSidebar && pageLabelingReady()) {
        // Repaints also call scrollIntoView. Preserve the user's viewport on
        // the same frame, while genuine navigation still reveals the new row.
        if (position) restoreSidebarPosition(position);
        else revealCurrentFrame();
      }
      return result;
    };
    state.sidebarRenderingInstalled = true;
  }

  function statusIcon(value) {
    try { if (typeof FS_ICON !== "undefined" && FS_ICON[value]) return FS_ICON[value]; } catch (_) {}
    return value === "done" ? "●" : value === "wip" ? "◐" : "○";
  }

  function statusName(value) {
    try { if (typeof FS_NAME !== "undefined" && FS_NAME[value]) return FS_NAME[value]; } catch (_) {}
    return value === "done" ? "Done" : value === "wip" ? "In progress" : "Not checked";
  }

  function refreshClipSummary(details) {
    const frames = Array.from(details.querySelectorAll("li[data-g]"));
    if (!frames.length) return;
    const stats = getMeta(frames);
    const meta = details.querySelector(":scope > summary .nl-clip-meta");
    if (meta && meta.textContent !== stats.text) meta.textContent = stats.text;

    const wanted = stats.checkpoint >= 0 ? frames[stats.checkpoint] : null;
    for (const marker of details.querySelectorAll(".nl-checkpoint")) {
      if (!wanted || marker.closest("li") !== wanted) marker.remove();
    }
    if (wanted && !wanted.querySelector(":scope > .nl-checkpoint")) {
      const checkpoint = document.createElement("span");
      checkpoint.className = "nl-checkpoint";
      checkpoint.textContent = "📍";
      const name = wanted.querySelector(".name");
      if (name) name.before(checkpoint); else wanted.prepend(checkpoint);
    }
    const marker = wanted?.querySelector(":scope > .nl-checkpoint");
    if (marker) {
      const title = `Checkpoint: frame ${stats.checkpoint + 1}/${stats.total} trong clip`;
      if (marker.title !== title) marker.title = title;
    }
    refreshClipStatusControls(details);
  }

  function refreshVisibleFrameStates() {
    for (const li of state.list?.querySelectorAll("li[data-g]") || []) {
      const g = Number(li.dataset.g);
      const value = frameState(g);
      let badge = li.querySelector(":scope > .fs");
      if (!badge) {
        badge = document.createElement("span");
        li.prepend(badge);
      }
      const className = `fs ${value}`;
      if (badge.className !== className) badge.className = className;
      const title = statusName(value);
      if (badge.title !== title) badge.title = title;
      const icon = statusIcon(value);
      if (badge.textContent !== icon) badge.textContent = icon;

      const time = li.querySelector(".tm");
      if (time) {
        const edited = Boolean(typeof S !== "undefined" && S.ledits?.[rvKey(g)]);
        const base = time.textContent.replace(/\s*✎\s*$/, "");
        const next = edited ? `${base} ✎` : base;
        if (time.textContent !== next) time.textContent = next;
      }
    }
    for (const details of state.list?.querySelectorAll(".nl-clip") || []) refreshClipSummary(details);
  }

  function ensureStatusRendering() {
    if (state.statusRenderingInstalled || typeof fsRender !== "function") return;
    const nativeRender = fsRender;
    fsRender = function (...args) {
      const canPatch = pageLabelingReady() && !S.onlyTodo &&
        Boolean(state.list?.querySelector(".grp.nl-organized"));
      if (!canPatch) return nativeRender.apply(this, args);

      const position = captureSidebarPosition();
      state.applying = true;
      try {
        try { if (typeof renderTabs === "function") renderTabs(); } catch (_) {}
        try {
          if (typeof fsLocked === "function" && fsLocked() && typeof ED !== "undefined") {
            ED.sel = -1;
            ED.drag = null;
            if (typeof LM !== "undefined") LM.drag = null;
          }
        } catch (_) {}
        refreshVisibleFrameStates();
        try { if (typeof renderProg === "function") renderProg(); } catch (_) {}
        try { if (typeof lsBoxRender === "function") lsBoxRender(); } catch (_) {}
        try { if (typeof drawBar === "function") drawBar(); } catch (_) {}
        updateMarkedUI();
        if (position) restoreSidebarPosition(position);
      } finally {
        // Do not schedule a complete sidebar pass for mutations made above.
        state.observer?.takeRecords();
        state.applying = false;
      }
    };
    state.statusRenderingInstalled = true;
  }

  function organizeGroup(row) {
    if (row.classList.contains("nl-organized")) return;
    const label = row.querySelector(":scope > .vlab");
    const sourceList = row.querySelector(":scope > ul");
    if (!label || !sourceList) return;

    const partName = (label.textContent || "Không rõ part").trim();
    const buckets = new Map();
    for (const li of Array.from(sourceList.children)) {
      if (li.tagName !== "LI") continue;
      const no = getClipNo(li);
      if (!buckets.has(no)) buckets.set(no, []);
      buckets.get(no).push(li);
    }
    if (!buckets.size) return;

    const partTotal = document.createElement("span");
    partTotal.className = "nl-part-total";
    partTotal.textContent = `${Array.from(buckets.values()).reduce((sum, items) => sum + items.length, 0)} ảnh`;
    partTotal.title = `Tổng số ảnh của part ${partName}`;
    label.appendChild(partTotal);

    // Move the large native list off the live document before redistributing
    // its rows. This avoids thousands of connected-DOM mutation/layout steps.
    const anchor = document.createComment("nota-clips");
    sourceList.replaceWith(anchor);

    const clips = document.createElement("div");
    clips.className = "nl-clips";

    for (const [no, items] of buckets) {
      const details = document.createElement("details");
      details.className = "nl-clip";
      details.dataset.clip = no;
      details.dataset.key = clipKey(partName, no);

      const summary = document.createElement("summary");
      const noEl = document.createElement("b");
      noEl.className = "nl-clip-no";
      noEl.textContent = no;
      const stats = getMeta(items);
      if (stats.checkpoint >= 0) {
        const checkpoint = document.createElement("span");
        checkpoint.className = "nl-checkpoint";
        checkpoint.title = `Checkpoint: frame ${stats.checkpoint + 1}/${stats.total} trong clip`;
        checkpoint.textContent = "📍";
        const rowName = items[stats.checkpoint].querySelector(".name");
        if (rowName) rowName.before(checkpoint);
        else items[stats.checkpoint].prepend(checkpoint);
      }

      const meta = document.createElement("span");
      meta.className = "nl-clip-meta";
      meta.textContent = stats.text;
      const statusActions = document.createElement("div");
      statusActions.className = "nl-clip-status-actions";
      statusActions.setAttribute("role", "group");
      statusActions.setAttribute("aria-label", `Đổi trạng thái toàn bộ clip ${no} · ${partName}`);
      for (const [value, caption, title] of [
        ["done", "Done", "Chuyển toàn bộ frame trong clip sang Done"],
        ["todo", "Not checked", "Chuyển toàn bộ frame trong clip sang Not checked"],
        ["wip", "In progress", "Chuyển toàn bộ frame trong clip sang In progress"]
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.state = value;
        button.textContent = caption;
        button.title = title;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setWholeClipState(details, value, button);
        });
        statusActions.appendChild(button);
      }
      statusActions.addEventListener("keydown", (event) => event.stopPropagation());
      summary.append(noEl, meta, statusActions);

      // Record the user's intention before the native <details> click toggles.
      // This prevents a pending render pass from reopening a clip immediately.
      summary.addEventListener("click", () => {
        if (details.open) {
          state.openClips.delete(details.dataset.key);
          state.manuallyClosedClips.add(details.dataset.key);
        } else {
          state.openClips.add(details.dataset.key);
          state.manuallyClosedClips.delete(details.dataset.key);
        }
      });

      const ul = document.createElement("ul");
      for (const li of items) ul.appendChild(li);

      const hasCurrent = items.some((li) => li.classList.contains("cur"));
      details.classList.toggle("nl-current", hasCurrent);
      details.open = state.openClips.has(details.dataset.key) ||
        (hasCurrent && !state.manuallyClosedClips.has(details.dataset.key));
      if (details.open) state.openClips.add(details.dataset.key);

      details.addEventListener("toggle", () => {
        if (details.open) {
          state.openClips.add(details.dataset.key);
          state.manuallyClosedClips.delete(details.dataset.key);
        } else {
          state.openClips.delete(details.dataset.key);
          state.manuallyClosedClips.add(details.dataset.key);
        }
      });
      details.append(summary, ul);
      refreshClipStatusControls(details);
      clips.appendChild(details);
    }

    row.dataset.partName = partName;
    row.classList.add("nl-organized");
    anchor.replaceWith(clips);
  }

  function refreshClipStatusControls(details) {
    const control = details.querySelector(".nl-clip-status-actions");
    if (!control || control.dataset.busy === "true") return;
    const states = Array.from(details.querySelectorAll("li[data-g]"))
      .map((li) => frameState(Number(li.dataset.g)));
    if (!states.length) return;
    const allDone = states.every((value) => value === "done");
    const allWip = states.every((value) => value === "wip");
    const allTodo = states.every((value) => value === "todo");
    for (const button of control.querySelectorAll("button[data-state]")) {
      const value = button.dataset.state;
      const current = value === "done" ? allDone : value === "wip" ? allWip : allTodo;
      button.classList.toggle("current", current);
      button.disabled = current;
      button.setAttribute("aria-pressed", String(current));
    }
  }

  function notify(message) {
    try {
      if (typeof flash === "function") {
        flash(message);
        return;
      }
    } catch (_) {}
    console.info(`[NOTA Labeling Organizer] ${message}`);
  }

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || response.statusText || `HTTP ${response.status}`);
    return data;
  }

  async function runQueue(items, worker, onProgress, concurrency = 4) {
    let cursor = 0;
    let completed = 0;
    let firstError = null;

    async function consume() {
      while (!firstError) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        try {
          await worker(items[index], index);
          completed += 1;
          if (onProgress) onProgress(completed, items.length);
        } catch (error) {
          firstError = error;
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume));
    return { completed, error: firstError };
  }

  function updateFrameState(g, label, value, responseData) {
    const key = typeof rvKey === "function" ? rvKey(g) : null;
    if (!key) return;
    if (responseData?.item && responseData.key) {
      S.fstat[responseData.key] = responseData.item;
      return;
    }
    const frame = (S.fstat[key] = S.fstat[key] || {});
    if (value === "todo") delete frame[label];
    else frame[label] = { s: value };
  }

  async function saveFrameState(g, label, value, expectedGeneration) {
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const [segmentIndex, frameIndex] = loc(g);
    const segment = S.sess.segments[segmentIndex];
    const data = await requestJson("/api/frame_status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: S.sess.bucket,
        prefix: segPfx(segmentIndex),
        seg: segment.name,
        i: frameIndex,
        label,
        state: value
      })
    });
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    updateFrameState(g, label, value, data);
  }

  async function setWholeClipState(details, value, sourceButton) {
    if (!pageLabelingReady() || state.operationBusy) return;
    const label = S.labelSel;
    const generation = S.gen;
    const targets = Array.from(details.querySelectorAll("li[data-g]"))
      .map((li) => Number(li.dataset.g))
      .filter((g) => Number.isInteger(g) && frameState(g) !== value);

    if (!targets.length) {
      refreshClipStatusControls(details);
      return;
    }
    state.operationBusy = true;
    const control = sourceButton.closest(".nl-clip-status-actions");
    control.dataset.busy = "true";
    control.setAttribute("aria-busy", "true");
    const originalText = sourceButton.textContent;
    for (const button of control.querySelectorAll("button")) button.disabled = true;
    sourceButton.textContent = `0/${targets.length}`;

    try {
      const result = await runQueue(
        targets,
        (g) => saveFrameState(g, label, value, generation),
        (done, total) => { if (sourceButton.isConnected) sourceButton.textContent = `${done}/${total}`; },
        4
      );
      if (typeof fsRender === "function" && S.gen === generation) fsRender();
      const action = value === "done" ? "Done" : value === "wip" ? "chuyển In progress" : "chuyển Not checked";
      if (result.error) notify(`Đã ${action} ${result.completed}/${targets.length} frame; dừng vì lỗi: ${result.error.message}`);
      else notify(`Đã ${action} ${targets.length} frame trong clip`);
    } finally {
      state.operationBusy = false;
      delete control.dataset.busy;
      control.removeAttribute("aria-busy");
      if (sourceButton.isConnected) sourceButton.textContent = originalText;
      if (control.isConnected && S.gen === generation) refreshClipStatusControls(details);
    }
  }

  function cloneEyeItems(items) {
    return (items || []).map((item) => {
      if (!Array.isArray(item?.pts)) return null;
      return {
        pts: item.pts.map((point) => Array.isArray(point) && point.length >= 2
          ? [Number(point[0]), Number(point[1])]
          : null),
        ...(item.closed ? { closed: true } : {})
      };
    }).filter(Boolean);
  }

  function currentEyeItems() {
    if (!pageLabelingReady("eye_lmk")) return [];
    try {
      const key = rvKey(S.shownG);
      if (typeof ED !== "undefined" && ED.key === key && ED.lab === "eye_lmk" && Array.isArray(ED.items)) {
        return cloneEyeItems(ED.items);
      }
      const saved = S.ledits?.[key]?.eye_lmk;
      if (saved) return cloneEyeItems(saved);
      const [segmentIndex, frameIndex] = loc(S.shownG);
      const data = S.al.get(segmentIndex);
      const frame = data && !(data instanceof Promise) ? data.frames?.[String(frameIndex)] : null;
      return frame && typeof alBoxes === "function" ? cloneEyeItems(alBoxes(frame, "eye_lmk")) : [];
    } catch (_) {
      return [];
    }
  }

  function currentEyeClipContext() {
    if (!pageLabelingReady("eye_lmk")) return null;
    const current = state.list?.querySelector(`li[data-g="${S.shownG}"]`) || state.list?.querySelector("li.cur");
    const details = current?.closest(".nl-clip");
    if (!details) return null;
    const frames = Array.from(details.querySelectorAll("li[data-g]"))
      .map((li) => Number(li.dataset.g))
      .filter(Number.isInteger);
    const source = Number(current.dataset.g);
    const sourceIndex = frames.indexOf(source);
    if (sourceIndex < 0) return null;
    const sourceItems = currentEyeItems();
    let selected = [];
    try {
      if (typeof LM !== "undefined" && Number.isInteger(LM.n) && LM.n >= 0 && LM.n < sourceItems.length) {
        selected = [LM.n];
      }
    } catch (_) {}
    return {
      details,
      frames,
      source,
      sourceIndex,
      clip: details.dataset.clip || "clip",
      generation: S.gen,
      sourceKey: typeof rvKey === "function" ? rvKey(source) : "",
      label: "eye_lmk",
      labelName: "eye 15pt",
      sourceItems,
      selected
    };
  }

  function cloneGenericItems(items) {
    return (items || []).map((item) => {
      if (Array.isArray(item?.box) && item.box.length === 4) {
        return { box: item.box.map(Number), ...(item.cls ? { cls: item.cls } : {}) };
      }
      if (Array.isArray(item?.pts)) {
        return {
          pts: item.pts.map((point) => Array.isArray(point) && point.length >= 2
            ? [Number(point[0]), Number(point[1])]
            : null),
          ...(item.closed ? { closed: true } : {})
        };
      }
      return null;
    }).filter(Boolean);
  }

  function genericLabelName(label) {
    try {
      if (typeof RV_NAME !== "undefined" && RV_NAME[label]) return RV_NAME[label];
    } catch (_) {}
    return label === "face_mask" ? "mask" : label === "face_lmk" ? "face 7pt" : label;
  }

  function currentGenericItems(label) {
    if (!GENERIC_COPY_LABELS.has(label) || !pageLabelingReady(label)) return [];
    try {
      const key = rvKey(S.shownG);
      if (typeof ED !== "undefined" && ED.key === key && ED.lab === label && Array.isArray(ED.items)) {
        return cloneGenericItems(ED.items);
      }
      const saved = S.ledits?.[key]?.[label];
      if (saved) return cloneGenericItems(saved);
      const [segmentIndex, frameIndex] = loc(S.shownG);
      const data = S.al.get(segmentIndex);
      const frame = data && !(data instanceof Promise) ? data.frames?.[String(frameIndex)] : null;
      return frame && typeof alBoxes === "function" ? cloneGenericItems(alBoxes(frame, label)) : [];
    } catch (_) {
      return [];
    }
  }

  function currentGenericClipContext() {
    const label = typeof S !== "undefined" ? S.labelSel : "";
    if (!GENERIC_COPY_LABELS.has(label) || !pageLabelingReady(label)) return null;
    const current = state.list?.querySelector(`li[data-g="${S.shownG}"]`) || state.list?.querySelector("li.cur");
    const details = current?.closest(".nl-clip");
    if (!details) return null;
    const frames = Array.from(details.querySelectorAll("li[data-g]"))
      .map((li) => Number(li.dataset.g))
      .filter(Number.isInteger);
    const source = Number(current.dataset.g);
    const sourceIndex = frames.indexOf(source);
    if (sourceIndex < 0) return null;
    const sourceItems = currentGenericItems(label);
    let selected = [];
    let selectedMode = "";
    let selectedRank = -1;
    try {
      if (QUICK_BBOX_LABELS.has(label) && typeof ED !== "undefined" && ED.key === rvKey(source) &&
          ED.lab === label && Array.isArray(ED.items)) {
        const indexes = typeof edSelected === "function" ? edSelected() :
          ED.selSet?.size ? Array.from(ED.selSet) : Number.isInteger(ED.sel) && ED.sel >= 0 ? [ED.sel] : [];
        const index = indexes.length === 1 ? Number(indexes[0]) : -1;
        if (index >= 0 && index < sourceItems.length) {
          selected = [index];
          selectedMode = "clicked";
          selectedRank = bboxHorizontalOrder(sourceItems).findIndex((entry) => entry.index === index);
        }
      }
      const created = state.lastCreatedBox;
      if (!selected.length && label !== "face_lmk" && created && created.generation === S.gen && created.label === label &&
          created.key === rvKey(source) && typeof ED !== "undefined" && ED.key === created.key && ED.lab === label) {
        const index = ED.items.indexOf(created.item);
        if (index >= 0 && index < sourceItems.length) {
          selected = [index];
          selectedMode = "created";
        }
      }
    } catch (_) {}
    return {
      details, frames, source, sourceIndex,
      clip: details.dataset.clip || "clip",
      generation: S.gen,
      sourceKey: typeof rvKey === "function" ? rvKey(source) : "",
      label,
      labelName: genericLabelName(label),
      sourceItems,
      selected,
      selectedMode,
      selectedRank,
      operation: quickOperationMatches() ? { ...state.quickLastOperation } : null
    };
  }

  function quickOperationMatches(operation = state.quickLastOperation) {
    return Boolean(operation && quickBboxReady() && operation.generation === S.gen &&
      operation.label === S.labelSel && Number(operation.source ?? operation.g) === Number(S.shownG));
  }

  function trackQuickFrameHistory() {
    if (!quickBboxReady() || typeof ED === "undefined" || !Array.isArray(ED.items) ||
        ED.key !== rvKey(S.shownG) || ED.lab !== S.labelSel) return;
    const snapshot = {
      generation: S.gen,
      session: S.sess,
      label: S.labelSel,
      g: Number(S.shownG),
      key: ED.key,
      items: cloneGenericItems(ED.items)
    };
    const current = state.quickFrameCurrent;
    if (current && (current.generation !== snapshot.generation || current.session !== snapshot.session ||
        current.label !== snapshot.label || current.g !== snapshot.g)) {
      state.quickFramePrevious = current;
    }
    state.quickFrameCurrent = snapshot;
  }

  function rememberBboxUndo(frames, remote = false) {
    if (!quickBboxReady() || !frames?.length) return;
    state.bboxUndo.push({
      generation: S.gen,
      session: S.sess,
      label: S.labelSel,
      remote,
      frames: frames.map((frame) => ({ g: frame.g, items: cloneGenericItems(frame.items) }))
    });
    if (state.bboxUndo.length > 30) state.bboxUndo.splice(0, state.bboxUndo.length - 30);
  }

  function replaceCurrentBboxItems(items, operation, message) {
    if (!quickBboxReady() || !bboxEditingAvailable()) return false;
    const before = cloneGenericItems(ED.items);
    rememberBboxUndo([{ g: Number(S.shownG), items: before }]);
    ED.items.splice(0, ED.items.length, ...cloneGenericItems(items));
    if (typeof edClearSel === "function") edClearSel();
    else { ED.sel = -1; ED.selSet?.clear(); }
    state.lastCreatedBox = null;
    state.bodyEdgePatch = null;
    if (operation) state.quickLastOperation = {
      ...operation,
      generation: S.gen,
      session: S.sess,
      label: S.labelSel,
      source: Number(S.shownG)
    };
    try { if (typeof lsTouch === "function") lsTouch(); } catch (_) {}
    if (typeof edSave === "function") edSave();
    if (typeof edRepaint === "function") edRepaint();
    trackQuickFrameHistory();
    if (message) notify(message);
    return true;
  }

  function bboxHorizontalOrder(items = ED.items) {
    return items.map((item, index) => ({
      index,
      x: Array.isArray(item?.box) ? (Number(item.box[0]) + Number(item.box[2])) / 2 : Infinity
    })).sort((left, right) => left.x - right.x || left.index - right.index);
  }

  function deleteQuickBbox(selector, advance = false) {
    if (!quickBboxReady() || !bboxEditingAvailable() || !ED.items.length) {
      notify("Frame hiện tại không có box có thể xóa");
      return false;
    }
    const items = cloneGenericItems(ED.items);
    const order = bboxHorizontalOrder(items);
    let indexes = [];
    let operation = { type: "delete", selector };
    if (selector === "all") indexes = items.map((_, index) => index);
    else if (selector === "left") indexes = order.length ? [order[0].index] : [];
    else if (selector === "right") indexes = order.length ? [order[order.length - 1].index] : [];
    else {
      let index = Number.isInteger(ED.hover?.n) ? ED.hover.n : Number.isInteger(ED.sel) && ED.sel >= 0 ? ED.sel : -1;
      if (items.length === 1) index = 0;
      if (index < 0 || index >= items.length) {
        notify("Có nhiều box: hãy rê chuột lên box cần xóa rồi nhấn X");
        return false;
      }
      indexes = [index];
      operation = { type: "delete", selector: "rank", rank: order.findIndex((entry) => entry.index === index) };
    }
    const removed = new Set(indexes);
    const next = items.filter((_, index) => !removed.has(index));
    const label = selector === "all" ? "toàn bộ box" : selector === "left" ? "box trái" : selector === "right" ? "box phải" : "box đã chọn";
    const changed = replaceCurrentBboxItems(next, operation, `Đã xóa ${label} · Ctrl+B để xóa hàng loạt`);
    if (changed && advance) setTimeout(() => navigateOrganizedFrames(1), 40);
    return changed;
  }

  function copyPreviousQuickBbox(advance = false) {
    if (!quickBboxReady() || !bboxEditingAvailable()) return false;
    const previous = state.quickFramePrevious;
    if (!previous || previous.generation !== S.gen || previous.session !== S.sess ||
        previous.label !== S.labelSel || previous.g === Number(S.shownG)) {
      notify("Chưa có frame vừa xem trước đó cùng label để sao chép");
      return false;
    }
    const changed = replaceCurrentBboxItems(previous.items, { type: "copy" },
      `Đã chép ${previous.items.length} box từ frame vừa xem`);
    if (changed && advance) setTimeout(() => navigateOrganizedFrames(1), 40);
    return changed;
  }

  function copyQuickBboxToClipboard() {
    if (!quickBboxReady() || !Array.isArray(ED?.items)) return;
    const indexes = typeof edSelected === "function" ? edSelected() :
      ED.selSet?.size ? Array.from(ED.selSet) : Number.isInteger(ED.sel) && ED.sel >= 0 ? [ED.sel] : [];
    const selectedIndex = indexes.length === 1 ? Number(indexes[0]) : -1;
    const selected = selectedIndex >= 0 && selectedIndex < ED.items.length;
    state.bboxClipboard = {
      generation: S.gen,
      session: S.sess,
      label: S.labelSel,
      items: cloneGenericItems(selected ? [ED.items[selectedIndex]] : ED.items),
      sourceItems: cloneGenericItems(ED.items),
      mode: selected ? "selected" : "all",
      rank: selected ? bboxHorizontalOrder(ED.items).findIndex((entry) => entry.index === selectedIndex) : -1
    };
    notify(selected
      ? `Đã copy box ${S.labelSel} đang chọn · chuyển frame rồi nhấn Ctrl+V`
      : `Đã copy ${ED.items.length} box ${S.labelSel} · chuyển frame rồi nhấn Ctrl+V`);
  }

  function pasteQuickBboxFromClipboard() {
    const clipboard = state.bboxClipboard;
    if (!quickBboxReady() || !bboxEditingAvailable()) return;
    if (!clipboard || clipboard.session !== S.sess || clipboard.label !== S.labelSel) {
      notify(`Clipboard chưa có box ${S.labelSel}`);
      return;
    }
    let nextItems = clipboard.items;
    if (clipboard.mode === "selected") {
      const copied = cloneGenericItems(clipboard.items)[0];
      nextItems = mergeCopiedGenericBbox(ED.items, copied, clipboard.sourceItems);
    }
    replaceCurrentBboxItems(nextItems, { type: "copy" }, clipboard.mode === "selected"
      ? `Đã dán box ${S.labelSel} · thay box trùng hoặc thêm box mới`
      : `Đã dán ${clipboard.items.length} box ${S.labelSel}`);
  }

  async function undoQuickBbox() {
    if (state.operationBusy || !quickBboxReady()) return;
    let index = state.bboxUndo.length - 1;
    while (index >= 0) {
      const entry = state.bboxUndo[index];
      if (entry.generation === S.gen && entry.session === S.sess && entry.label === S.labelSel) break;
      index -= 1;
    }
    if (index < 0) {
      notify(`Không còn thao tác ${S.labelSel} để hoàn tác`);
      return;
    }
    const [entry] = state.bboxUndo.splice(index, 1);
    state.operationBusy = true;
    try {
      const currentG = Number(S.shownG);
      const remoteFrames = [];
      for (const frame of entry.frames) {
        if (frame.g === currentG && bboxEditingAvailable()) {
          ED.items.splice(0, ED.items.length, ...cloneGenericItems(frame.items));
          if (typeof edClearSel === "function") edClearSel();
          if (typeof edSave === "function") edSave();
        } else remoteFrames.push(frame);
      }
      const result = await runQueue(remoteFrames, (frame) =>
        saveFrameGenericItems(frame.g, entry.label, frame.items, entry.generation), null, 4);
      if (result.error) throw result.error;
      state.quickLastOperation = null;
      state.bodyEdgePatch = null;
      if (typeof fsRender === "function") fsRender();
      if (typeof edRepaint === "function") edRepaint();
      notify(`Đã hoàn tác ${entry.frames.length > 1 ? `cả đợt ${entry.frames.length} frame` : "thao tác gần nhất"}`);
    } catch (error) {
      state.bboxUndo.splice(index, 0, entry);
      notify(`Không hoàn tác được: ${error.message}`);
    } finally {
      state.operationBusy = false;
    }
  }

  function bodyEdgeGeometry(event) {
    if (!pageLabelingReady("body") || !bboxEditingAvailable() || !ED.items.length) return null;
    const point = bboxEventPoint(event);
    const tolerance = 13 * point.sourceWidth / point.rect.width;
    let best = null;
    ED.items.forEach((item, itemIndex) => {
      if (!Array.isArray(item?.box)) return;
      const [x1, y1, x2, y2] = item.box.map(Number);
      const handles = [
        { edge: "top", coord: 1, point: [(x1 + x2) / 2, y1] },
        { edge: "right", coord: 2, point: [x2, (y1 + y2) / 2] },
        { edge: "bottom", coord: 3, point: [(x1 + x2) / 2, y2] },
        { edge: "left", coord: 0, point: [x1, (y1 + y2) / 2] }
      ];
      for (const handle of handles) {
        const distance = Math.hypot(point.sourcePoint[0] - handle.point[0], point.sourcePoint[1] - handle.point[1]);
        if (distance <= tolerance && (!best || distance < best.distance)) {
          best = { ...handle, itemIndex, distance, box: item.box.slice() };
        }
      }
    });
    return best;
  }

  function onBodyEdgeDoubleClick(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const geometry = bodyEdgeGeometry(event);
    if (!geometry) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.bodyEdgePatch = {
      generation: S.gen,
      session: S.sess,
      label: "body",
      g: Number(S.shownG),
      key: ED.key,
      itemIndex: geometry.itemIndex,
      edge: geometry.edge,
      coord: geometry.coord,
      originalBox: geometry.box.slice(),
      delta: 0,
      ready: false
    };
    ED.sel = geometry.itemIndex;
    ED.selSet?.clear();
    if (typeof edRepaint === "function") edRepaint();
    notify(`Đã chọn cạnh ${geometry.edge} màu xanh · kéo cạnh rồi nhấn Ctrl+B`);
  }

  function finalizeBodyEdgePatch() {
    const patch = state.bodyEdgePatch;
    if (!patch || patch.generation !== S.gen || patch.key !== ED?.key || patch.g !== Number(S.shownG) ||
        !Array.isArray(ED.items?.[patch.itemIndex]?.box) || !ED.drag || ED.drag.n !== patch.itemIndex) return;
    const box = ED.items[patch.itemIndex].box.slice();
    const beforeItems = cloneGenericItems(ED.items);
    beforeItems[patch.itemIndex].box = patch.originalBox.slice();
    const next = patch.originalBox.slice();
    next[patch.coord] = box[patch.coord];
    const width = Number(S.sess?.src_w) || 0;
    const height = Number(S.sess?.src_h) || 0;
    if (patch.coord === 0) next[0] = Math.max(0, Math.min(next[2] - 1, next[0]));
    if (patch.coord === 1) next[1] = Math.max(0, Math.min(next[3] - 1, next[1]));
    if (patch.coord === 2) next[2] = Math.min(width, Math.max(next[0] + 1, next[2]));
    if (patch.coord === 3) next[3] = Math.min(height, Math.max(next[1] + 1, next[3]));
    patch.delta = next[patch.coord] - patch.originalBox[patch.coord];
    if (Math.abs(patch.delta) < 0.05) return;
    ED.items[patch.itemIndex].box = next;
    patch.ready = true;
    patch.currentBox = next.slice();
    rememberBboxUndo([{ g: patch.g, items: beforeItems }]);
    state.quickLastOperation = {
      ...patch,
      type: "edge",
      source: patch.g,
      value: next[patch.coord]
    };
    notify(`Đã đặt cạnh ${patch.edge} tại ${next[patch.coord].toFixed(1)} px · Ctrl+B để áp dụng đúng vị trí này`);
  }

  function drawBodyEdgePatch() {
    const patch = state.bodyEdgePatch;
    if (!patch || patch.generation !== S.gen || patch.key !== ED?.key || patch.g !== Number(S.shownG) ||
        !Array.isArray(ED.items?.[patch.itemIndex]?.box) || typeof ctx === "undefined") return;
    const canvas = document.getElementById("view");
    const scale = canvas.width / S.sess.src_w;
    const unit = typeof pxK === "function" ? pxK() : canvas.width / canvas.getBoundingClientRect().width;
    const original = patch.originalBox.map((value) => value * scale);
    const current = ED.items[patch.itemIndex].box.map((value) => value * scale);
    const line = (box, edge) => edge === "top" ? [box[0], box[1], box[2], box[1]] :
      edge === "right" ? [box[2], box[1], box[2], box[3]] :
      edge === "bottom" ? [box[0], box[3], box[2], box[3]] : [box[0], box[1], box[0], box[3]];
    const oldLine = line(original, patch.edge);
    const newLine = line(current, patch.edge);
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 2 * unit;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(oldLine[0], oldLine[1]); ctx.lineTo(oldLine[2], oldLine[3]); ctx.stroke();
    ctx.strokeStyle = "#42f58d";
    ctx.beginPath(); ctx.moveTo(newLine[0], newLine[1]); ctx.lineTo(newLine[2], newLine[3]); ctx.stroke();
    if (patch.ready || Math.abs(newLine[0] - oldLine[0]) + Math.abs(newLine[1] - oldLine[1]) > .1) {
      ctx.setLineDash([4 * unit, 3 * unit]);
      ctx.beginPath();
      ctx.moveTo(oldLine[0], oldLine[1]); ctx.lineTo(newLine[0], newLine[1]);
      ctx.moveTo(oldLine[2], oldLine[3]); ctx.lineTo(newLine[2], newLine[3]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const mx = (newLine[0] + newLine[2]) / 2;
    const my = (newLine[1] + newLine[3]) / 2;
    ctx.fillStyle = "#42f58d";
    ctx.fillRect(mx - 4 * unit, my - 4 * unit, 8 * unit, 8 * unit);
    ctx.restore();
  }

  function trackCreatedBoxOnMouseUp() {
    try {
      const label = typeof S !== "undefined" ? S.labelSel : "";
      if (!GENERIC_COPY_LABELS.has(label) || label === "face_lmk" || typeof ED === "undefined" ||
          !ED.drag?.create || !Array.isArray(ED.items)) return;
      const item = ED.items[ED.drag.n];
      if (!Array.isArray(item?.box) || item.box.length !== 4) return;
      state.lastCreatedBox = {
        generation: S.gen,
        key: ED.key,
        label,
        item
      };
      if (state.bboxMode === "create") {
        state.bboxMode = null;
        setTimeout(() => {
          if (typeof ED !== "undefined" && ED.items?.includes(item)) {
            notify("Đã tạo box mới · Ctrl+B để sao chép box này");
          } else if (state.lastCreatedBox?.item === item) {
            state.lastCreatedBox = null;
          }
        }, 0);
      }
    } catch (_) {}
  }

  function bboxLabelingReady() {
    try {
      return typeof S !== "undefined" && BBOX_LABELS.has(S.labelSel) && pageLabelingReady(S.labelSel);
    } catch (_) {
      return false;
    }
  }

  function bboxEditingAvailable() {
    try {
      return bboxLabelingReady() && typeof ED !== "undefined" && Array.isArray(ED.items) &&
        (typeof edActive !== "function" || edActive());
    } catch (_) {
      return false;
    }
  }

  function bboxEventPoint(event) {
    const canvas = document.getElementById("view");
    const rect = canvas.getBoundingClientRect();
    const sourceWidth = Number(S.sess?.src_w) || canvas.width;
    const sourceHeight = Number(S.sess?.src_h) || canvas.height;
    const canvasPoint = [
      (event.clientX - rect.left) * canvas.width / rect.width,
      (event.clientY - rect.top) * canvas.height / rect.height
    ];
    const rawSourcePoint = [
      (event.clientX - rect.left) * sourceWidth / rect.width,
      (event.clientY - rect.top) * sourceHeight / rect.height
    ];
    const sourcePoint = [
      Math.max(0, Math.min(sourceWidth, rawSourcePoint[0])),
      Math.max(0, Math.min(sourceHeight, rawSourcePoint[1]))
    ];
    return { canvas, rect, canvasPoint, rawSourcePoint, sourcePoint, sourceWidth, sourceHeight };
  }

  function discardBboxCreateDraft() {
    const draft = state.bboxCreateDraft;
    state.bboxCreateDraft = null;
    if (!draft || typeof ED === "undefined" || !Array.isArray(ED.items)) return;
    const index = ED.items.indexOf(draft.item);
    if (index >= 0) ED.items.splice(index, 1);
    if (ED.drag?.create && ED.drag.n === index) ED.drag = null;
    if (ED.sel === index) ED.sel = -1;
    ED.selSet?.delete(index);
  }

  function cancelBboxMode() {
    discardBboxCreateDraft();
    state.bboxMode = null;
    state.bboxDeleteRegion = null;
    try {
      if (typeof ED !== "undefined") {
        ED.poly = [];
        ED.marq = null;
      }
      const canvas = document.getElementById("view");
      if (canvas) canvas.style.cursor = "";
      if (typeof edRepaint === "function") edRepaint();
    } catch (_) {}
  }

  function setBboxMode(mode) {
    if (!bboxLabelingReady()) return;
    if (state.bboxMode === mode) {
      cancelBboxMode();
      return;
    }
    if (state.bboxMode) cancelBboxMode();
    state.bboxMode = mode;
    state.bboxDeleteRegion = null;
    if (typeof ED !== "undefined") {
      ED.poly = [];
      ED.marq = null;
      if (typeof edClearSel === "function") edClearSel();
      else { ED.sel = -1; ED.selSet?.clear(); }
    }
    const canvas = document.getElementById("view");
    if (canvas) canvas.style.cursor = "crosshair";
    if (typeof edRepaint === "function") edRepaint();
    notify(mode === "create"
      ? "Tạo box: click góc đầu, di chuyển chuột rồi click góc đối diện"
      : "Xóa box: chấm polygon rồi click điểm đầu hoặc chuột phải · Esc để thoát");
  }

  function updateBboxCreateDraft(event) {
    const draft = state.bboxCreateDraft;
    if (!draft || !bboxEditingAvailable() || draft.generation !== S.gen || draft.key !== ED.key ||
        draft.label !== S.labelSel || !ED.items?.includes(draft.item)) return false;
    const point = bboxEventPoint(event);
    const [x0, y0] = draft.startSource;
    const [x1, y1] = point.rawSourcePoint;
    draft.currentSource = [x1, y1];
    draft.currentCanvas = point.canvasPoint.slice();
    draft.item.box = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
    ED.mouse = point.canvasPoint.slice();
    if (typeof edRepaint === "function") edRepaint();
    return true;
  }

  function finishBboxCreateDraft(event) {
    const draft = state.bboxCreateDraft;
    if (!draft || !updateBboxCreateDraft(event)) return false;
    const widthOnCanvas = Math.abs(draft.currentCanvas[0] - draft.startCanvas[0]);
    const heightOnCanvas = Math.abs(draft.currentCanvas[1] - draft.startCanvas[1]);
    if (widthOnCanvas < 4 || heightOnCanvas < 4) {
      notify("Box quá nhỏ · di chuyển chuột xa hơn rồi click lại");
      return true;
    }
    const width = Number(S.sess?.src_w) || 0;
    const height = Number(S.sess?.src_h) || 0;
    const [x1, y1, x2, y2] = draft.item.box;
    draft.item.box = [
      Math.max(0, Math.min(width, x1)),
      Math.max(0, Math.min(height, y1)),
      Math.max(0, Math.min(width, x2)),
      Math.max(0, Math.min(height, y2))
    ];
    if (quickBboxReady()) {
      rememberBboxUndo([{
        g: Number(S.shownG),
        items: cloneGenericItems(ED.items.filter((item) => item !== draft.item))
      }]);
    }
    state.lastCreatedBox = {
      generation: S.gen,
      key: ED.key,
      label: S.labelSel,
      item: draft.item
    };
    state.bboxCreateDraft = null;
    state.bboxMode = null;
    ED.drag = null;
    ED.marq = null;
    const canvas = document.getElementById("view");
    if (canvas) canvas.style.cursor = "";
    try { if (typeof lsTouch === "function") lsTouch(); } catch (_) {}
    if (typeof edSave === "function") edSave();
    if (typeof edRepaint === "function") edRepaint();
    notify("Đã tạo box mới · Ctrl+B để sao chép box này");
    return true;
  }

  function bboxDeleteTarget(event) {
    const canvas = document.getElementById("view");
    const stage = document.getElementById("stage");
    return event.target === canvas || (!!stage && event.target === stage);
  }

  function commitBboxDeletePolygon() {
    if (!bboxEditingAvailable() || state.bboxMode !== "delete") return;
    if (!Array.isArray(ED.poly) || ED.poly.length < 3) {
      notify("Vùng xóa cần ít nhất 3 điểm");
      return;
    }
    const points = ED.poly.map((point) => point.slice());
    state.bboxDeleteRegion = { generation: S.gen, key: ED.key, label: S.labelSel, points };
    const removed = [];
    const beforeItems = cloneGenericItems(ED.items);
    ED.items.forEach((item, index) => {
      try {
        if (Array.isArray(item?.box) && typeof boxInPoly === "function" && boxInPoly(item.box, points)) removed.push(index);
      } catch (_) {}
    });
    for (const index of removed.reverse()) ED.items.splice(index, 1);
    if (quickBboxReady()) {
      // The polygon itself is the bulk operation. Keep it even when it does
      // not hit a box on the source frame, because matching boxes can still
      // exist inside the same region on the destination frames.
      if (removed.length) {
        rememberBboxUndo([{ g: Number(S.shownG), items: beforeItems }]);
      }
      state.quickLastOperation = {
        type: "delete",
        selector: "region",
        region: points.map((point) => point.slice()),
        generation: S.gen,
        session: S.sess,
        label: S.labelSel,
        source: Number(S.shownG)
      };
    }
    ED.poly = [];
    if (typeof edClearSel === "function") edClearSel();
    else { ED.sel = -1; ED.selSet?.clear(); }
    if (removed.length && typeof edSave === "function") edSave();
    if (typeof lsTouch === "function") lsTouch();
    if (typeof edRepaint === "function") edRepaint();
    notify(removed.length
      ? `Đã xóa ${removed.length} box · tiếp tục vẽ vùng khác hoặc nhấn Esc`
      : "Không có box nào trong vùng xóa · tiếp tục vẽ hoặc nhấn Esc");
  }

  function onBboxMouseDown(event) {
    if (!bboxLabelingReady() || event.button !== 0) return;
    const bboxCanvas = document.getElementById("view");
    const bboxStage = document.getElementById("stage");
    if (state.bodyEdgePatch?.ready && (event.target === bboxCanvas || event.target === bboxStage)) {
      state.bodyEdgePatch = null;
      if (state.quickLastOperation?.type === "edge") state.quickLastOperation = null;
    }
    if (state.bboxMode && !bboxEditingAvailable()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify("Frame cần ở trạng thái In progress để sửa bbox");
      return;
    }
    if (!bboxEditingAvailable()) return;
    const canvas = document.getElementById("view");
    const onCanvas = event.target === canvas;
    if (state.bboxMode === "delete") {
      if (!bboxDeleteTarget(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const point = bboxEventPoint(event).sourcePoint;
      if (ED.poly.length >= 3) {
        const first = ED.poly[0];
        const tolerance = 12 * S.sess.src_w / canvas.getBoundingClientRect().width;
        if (Math.hypot(point[0] - first[0], point[1] - first[1]) <= tolerance) {
          commitBboxDeletePolygon();
          return;
        }
      }
      if (!ED.poly.length) state.bboxDeleteRegion = null;
      ED.poly.push(point);
      if (typeof edRepaint === "function") edRepaint();
      return;
    }
    if (!onCanvas) return;
    if (state.bboxMode === "create") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (state.bboxCreateDraft) {
        finishBboxCreateDraft(event);
        return;
      }
      try { if (typeof pause === "function") pause(); } catch (_) {}
      const point = bboxEventPoint(event);
      const item = { box: [point.sourcePoint[0], point.sourcePoint[1], point.sourcePoint[0], point.sourcePoint[1]] };
      if (OBJECT_BBOX_LABELS.has(S.labelSel)) item.cls = S.labelSel;
      ED.items.push(item);
      if (typeof edClearSel === "function") edClearSel();
      else { ED.sel = -1; ED.selSet?.clear(); }
      ED.sel = ED.items.length - 1;
      ED.drag = null;
      ED.marq = null;
      state.bboxCreateDraft = {
        generation: S.gen,
        key: ED.key,
        label: S.labelSel,
        item,
        startSource: point.sourcePoint.slice(),
        currentSource: point.sourcePoint.slice(),
        startCanvas: point.canvasPoint.slice(),
        currentCanvas: point.canvasPoint.slice()
      };
      if (typeof edRepaint === "function") edRepaint();
      notify("Đã đặt góc đầu · di chuyển chuột rồi click để hoàn tất box");
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify("Nhấn N, click góc đầu rồi click góc đối diện để tạo box mới");
    }
  }

  function settleBboxInsideImage() {
    if (!bboxEditingAvailable() || !ED.drag || !ED.items?.[ED.drag.n]) return;
    const item = ED.items[ED.drag.n];
    if (!Array.isArray(item.box) || item.box.length !== 4) return;
    const width = Number(S.sess?.src_w) || 0;
    const height = Number(S.sess?.src_h) || 0;
    if (!width || !height) return;
    let [x1, y1, x2, y2] = item.box;
    // Crop each coordinate independently. The part that remains inside stays
    // exactly where the pointer put it; only the outside portion is cut.
    x1 = Math.max(0, Math.min(width, x1));
    x2 = Math.max(0, Math.min(width, x2));
    y1 = Math.max(0, Math.min(height, y1));
    y2 = Math.max(0, Math.min(height, y2));
    item.box = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
    const canvas = document.getElementById("view");
    if (canvas && state.bboxMode) canvas.style.cursor = "crosshair";
  }

  function onBboxMouseMove(event) {
    if (!bboxLabelingReady()) return;
    if (state.bboxMode === "create" && state.bboxCreateDraft) {
      event.preventDefault();
      event.stopImmediatePropagation();
      updateBboxCreateDraft(event);
      const canvas = document.getElementById("view");
      if (canvas) canvas.style.cursor = "crosshair";
      return;
    }
    if (state.bboxMode === "delete" && bboxEditingAvailable() && bboxDeleteTarget(event)) {
      const point = bboxEventPoint(event);
      ED.mouse = point.canvasPoint.map((value, index) => index ?
        Math.max(0, Math.min(point.canvas.height, value)) : Math.max(0, Math.min(point.canvas.width, value)));
      if (event.target !== point.canvas && typeof edRepaint === "function") edRepaint();
    }
    if (state.bboxMode) document.getElementById("view").style.cursor = "crosshair";
  }

  function drawBboxDeletePolygon() {
    if (state.bboxMode !== "delete" || !bboxLabelingReady() || typeof ED === "undefined" ||
        typeof ctx === "undefined" || !Array.isArray(ED.poly)) return;
    const saved = state.bboxDeleteRegion;
    const sameSavedRegion = saved && saved.generation === S.gen && saved.key === ED.key && saved.label === S.labelSel;
    const draft = ED.poly;
    const points = draft.length ? draft : sameSavedRegion ? saved.points : null;
    if (!points?.length) return;
    const canvas = document.getElementById("view");
    const scale = canvas.width / S.sess.src_w;
    const unit = typeof pxK === "function" ? pxK() : canvas.width / canvas.getBoundingClientRect().width;
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#ff4d5a";
    ctx.fillStyle = "rgba(255,77,90,.22)";
    ctx.lineWidth = 2 * unit;
    ctx.beginPath();
    points.forEach(([x, y], index) => ctx[index ? "lineTo" : "moveTo"](x * scale, y * scale));
    if (points.length >= 3) {
      ctx.closePath();
      ctx.fill();
    }
    ctx.stroke();
    if (draft.length && ED.mouse) {
      const [x, y] = draft[draft.length - 1];
      ctx.setLineDash([4 * unit, 4 * unit]);
      ctx.beginPath();
      ctx.moveTo(x * scale, y * scale);
      ctx.lineTo(ED.mouse[0], ED.mouse[1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const [x, y] of points) {
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, 3.5 * unit, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4d5a";
      ctx.fill();
    }
    ctx.restore();
  }

  function onBboxMouseUp(event) {
    if (state.bboxMode === "create" && state.bboxCreateDraft) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    // Closing an M polygon by clicking its first point commits on mousedown.
    // Do not let the matching mouseup fall through to the native bbox drag
    // cleanup, which would discard the just-created bulk delete operation.
    if (state.bboxMode === "delete") {
      if (bboxDeleteTarget(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      ED.drag = null;
      ED.marq = null;
      return;
    }
    // Match CVAT: while dragging, let the box follow the pointer outside the
    // image. On release, crop the outside portion at the nearest image edge,
    // then let the native editor save the resulting smaller box.
    settleBboxInsideImage();
    if (quickBboxReady() && ED.drag && !ED.drag.create &&
        !(state.bodyEdgePatch && !state.bodyEdgePatch.ready && state.bodyEdgePatch.key === ED.key)) {
      state.quickLastOperation = null;
    }
    if (quickBboxReady() && ED.drag?.moved && !ED.drag.create && Array.isArray(ED.drag.box0) &&
        !(state.bodyEdgePatch && state.bodyEdgePatch.key === ED.key &&
          state.bodyEdgePatch.itemIndex === ED.drag.n)) {
      const beforeItems = cloneGenericItems(ED.items);
      if (beforeItems[ED.drag.n]) beforeItems[ED.drag.n].box = ED.drag.box0.slice();
      rememberBboxUndo([{ g: Number(S.shownG), items: beforeItems }]);
    }
    finalizeBodyEdgePatch();
    trackCreatedBoxOnMouseUp();
    if (!bboxEditingAvailable() || state.bboxMode || !ED.marq) return;
    const marquee = ED.marq;
    if (Math.abs(marquee.x1 - marquee.x0) >= 4 || Math.abs(marquee.y1 - marquee.y0) >= 4) return;
    ED.marq = null;
    ED.poly = [];
    if (typeof edClearSel === "function") edClearSel();
    else { ED.sel = -1; ED.selSet?.clear(); }
    if (typeof edRepaint === "function") edRepaint();
  }

  function ensureEyeBulkDialog() {
    if (state.eyeBulkDialog?.isConnected) return state.eyeBulkDialog;
    const dialog = document.createElement("dialog");
    dialog.id = "nl-eye-bulk";
    dialog.className = "nl-bulk-dialog";
    dialog.innerHTML = `
      <form class="nl-modal" method="dialog">
        <h2>Sao chép eye 15pt theo clip</h2>
        <p class="nl-sub"></p>

        <span class="nl-label">Hướng áp dụng</span>
        <div class="nl-choice nl-directions">
          <button type="button" data-eye-direction="before">← Các frame trước</button>
          <button type="button" data-eye-direction="after">Các frame sau →</button>
          <button type="button" data-eye-direction="marked" class="nl-marked-target" hidden>◆ Frame đã đánh dấu</button>
        </div>

        <span class="nl-label nl-source-label">Đối tượng nguồn</span>
        <div class="nl-scope">
          <label class="nl-eye-selected-option"><input type="radio" name="nl-eye-scope" value="selected"><span class="nl-item-selected-text">Chỉ mắt đang chọn</span></label>
          <label><input type="radio" name="nl-eye-scope" value="all"><span class="nl-item-all-text">Tất cả mắt của frame hiện tại</span></label>
        </div>

        <span class="nl-label nl-write-label">Cách ghi vào frame đích</span>
        <div class="nl-scope nl-write-options">
          <label><input type="radio" name="nl-eye-write" value="merge" checked><span class="nl-item-merge-text">Thay mắt cùng vị trí và giữ các mắt còn lại</span></label>
          <label><input type="radio" name="nl-eye-write" value="replace"><span class="nl-item-replace-text">Thay toàn bộ mắt ở frame đích</span></label>
        </div>

        <label class="nl-label" for="nl-eye-bulk-count">Số frame đích hoặc end</label>
        <input id="nl-eye-bulk-count" class="nl-count" value="1" autocomplete="off" spellcheck="false">
        <div class="nl-preview" aria-live="polite"></div>

        <div class="nl-actions">
          <button type="button" class="nl-cancel">Hủy · Esc</button>
          <button type="button" class="primary nl-apply">Áp dụng · Enter</button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);
    for (const button of dialog.querySelectorAll("[data-eye-direction]")) {
      button.addEventListener("click", () => {
        state.eyeBulkDirection = button.dataset.eyeDirection;
        updateEyeBulkDialog();
      });
    }
    dialog.querySelector(".nl-count").addEventListener("input", updateEyeBulkDialog);
    for (const input of dialog.querySelectorAll('input[type="radio"]')) {
      input.addEventListener("change", updateEyeBulkDialog);
    }
    dialog.querySelector(".nl-cancel").addEventListener("click", cancelEyeBulkDialog);
    dialog.querySelector(".nl-apply").addEventListener("click", applyItemBulkCopy);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancelEyeBulkDialog();
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.tagName !== "BUTTON") {
        event.preventDefault();
        applyItemBulkCopy();
      }
    });
    dialog.addEventListener("close", () => {
      if (!dialog.open) {
        state.eyeBulkContext = null;
        if (dialog.contains(document.activeElement)) document.activeElement.blur();
      }
    });
    state.eyeBulkDialog = dialog;
    return dialog;
  }

  function cancelEyeBulkDialog() {
    if (state.operationBusy) return;
    state.eyeBulkContext = null;
    if (state.eyeBulkDialog?.contains(document.activeElement)) document.activeElement.blur();
    state.eyeBulkDialog?.close();
  }

  function selectedEyeBulkTargets() {
    const context = state.eyeBulkContext;
    if (!context) return { targets: [], error: "Không xác định được clip hiện tại." };
    if (state.eyeBulkDirection === "marked") {
      if (!bboxMarkedScopeMatches()) return { targets: [], error: "Danh sách frame đánh dấu không còn thuộc label hiện tại." };
      const targets = Array.from(state.bboxMarkedFrames)
        .filter((g) => Number.isInteger(g) && g !== context.source && S.lseq?.includes(g));
      return targets.length
        ? { targets, error: "" }
        : { targets: [], error: "Chưa đánh dấu frame đích nào bằng phím V." };
    }
    const raw = state.eyeBulkDialog.querySelector(".nl-count").value.trim().toLowerCase();
    const candidates = state.eyeBulkDirection === "before"
      ? context.frames.slice(0, context.sourceIndex).reverse()
      : context.frames.slice(context.sourceIndex + 1);
    let count;
    if (raw === "end") count = candidates.length;
    else if (/^[1-9]\d*$/.test(raw)) count = Number(raw);
    else return { targets: [], error: "Nhập số nguyên lớn hơn 0 hoặc end." };
    const selected = candidates.slice(0, count);
    if (!selected.length) return { targets: [], error: "Không còn frame nào theo hướng đã chọn trong clip này." };
    return { targets: selected, error: "" };
  }

  function updateEyeBulkDialog() {
    const dialog = state.eyeBulkDialog;
    const context = state.eyeBulkContext;
    if (!dialog || !context) return;
    for (const button of dialog.querySelectorAll("[data-eye-direction]")) {
      button.classList.toggle("on", button.dataset.eyeDirection === state.eyeBulkDirection);
    }
    const hasSelected = context.selected.length > 0;
    const quickMode = QUICK_BBOX_LABELS.has(context.label);
    const markedButton = dialog.querySelector(".nl-marked-target");
    markedButton.hidden = !quickMode;
    markedButton.textContent = `◆ Frame đã đánh dấu (${bboxMarkedScopeMatches() ? state.bboxMarkedFrames.size : 0})`;
    if (!quickMode && state.eyeBulkDirection === "marked") state.eyeBulkDirection = "after";
    dialog.querySelector(".nl-count").disabled = state.eyeBulkDirection === "marked";
    dialog.querySelector(".nl-eye-selected-option").hidden = !hasSelected;
    const checked = dialog.querySelector('input[name="nl-eye-scope"]:checked');
    if (!checked || (checked.value === "selected" && !hasSelected)) {
      dialog.querySelector(`input[name="nl-eye-scope"][value="${hasSelected ? "selected" : "all"}"]`).checked = true;
    }
    const operation = context.operation;
    const operationMode = operation?.type === "delete" || operation?.type === "edge";
    const scope = dialog.querySelector('input[name="nl-eye-scope"]:checked')?.value || "all";
    const sourceCount = operationMode ? 1 : scope === "selected" ? context.selected.length : context.sourceItems.length;
    const writeMode = dialog.querySelector('input[name="nl-eye-write"]:checked')?.value || "merge";
    const eyeMode = context.label === "eye_lmk";
    const boxMode = !eyeMode && context.label !== "face_lmk";
    dialog.querySelector("h2").textContent = operation?.type === "delete"
      ? `Xóa ${context.labelName} theo clip`
      : operation?.type === "edge" ? `Chỉnh riêng cạnh ${operation.edge} của body` : `Sao chép ${context.labelName} theo clip`;
    dialog.querySelector(".nl-source-label").textContent = eyeMode ? "Đối tượng nguồn" : "Phần cần sao chép";
    dialog.querySelector(".nl-source-label").hidden = operationMode;
    dialog.querySelector(".nl-scope").hidden = operationMode;
    dialog.querySelector(".nl-item-selected-text").textContent = eyeMode
      ? "Chỉ mắt đang chọn"
      : context.selectedMode === "clicked" ? "Chỉ box đang chọn" : "Chỉ box mới thêm";
    dialog.querySelector(".nl-item-all-text").textContent = eyeMode
      ? "Tất cả mắt của frame hiện tại"
      : boxMode ? "Toàn bộ box hiện tại" : "Toàn bộ face 7pt hiện tại";
    dialog.querySelector(".nl-write-label").hidden = !eyeMode || operationMode;
    dialog.querySelector(".nl-write-options").hidden = !eyeMode || operationMode;
    dialog.querySelector(".nl-item-merge-text").textContent = eyeMode
      ? "Thay mắt cùng vị trí và giữ các mắt còn lại"
      : "";
    dialog.querySelector(".nl-item-replace-text").textContent = eyeMode
      ? "Thay toàn bộ mắt ở frame đích"
      : "";
    dialog.querySelector(".nl-sub").textContent =
      `${context.clip} · nguồn frame ${context.sourceIndex + 1}/${context.frames.length} · nhãn ${context.labelName}.`;
    const picked = selectedEyeBulkTargets();
    const preview = dialog.querySelector(".nl-preview");
    preview.classList.toggle("err", Boolean(picked.error) || !sourceCount);
    if (picked.error) preview.textContent = picked.error;
    else if (!sourceCount) preview.textContent = `Frame hiện tại không có ${context.labelName} để sao chép.`;
    else {
      const skipped = picked.targets.filter((g) => frameState(g) === "done").length;
      const writeText = eyeMode
        ? (writeMode === "replace" ? "thay toàn bộ mắt ở frame đích" : "thay mắt cùng vị trí, giữ các mắt còn lại")
        : scope === "selected"
          ? "thay box tương ứng, giữ các box khác; nếu không có box khớp thì thêm mới"
          : "thay bằng toàn bộ dữ liệu của frame nguồn";
      const directionText = state.eyeBulkDirection === "marked" ? "đã đánh dấu" :
        state.eyeBulkDirection === "after" ? "sau" : "trước";
      const actionText = operation?.type === "delete"
        ? `Xóa ${operation.selector === "all" ? "toàn bộ box" : operation.selector === "left" ? "box trái" : operation.selector === "right" ? "box phải" : operation.selector === "region" ? "box trong vùng M" : "box cùng thứ tự"}`
        : operation?.type === "edge"
          ? `Đặt cạnh ${operation.edge} tại ${Number(operation.value).toFixed(1)} px`
          : `Sao chép ${sourceCount} ${eyeMode ? "cụm mắt" : boxMode ? "box" : "cụm face 7pt"}`;
      preview.textContent = `${actionText} trên ${picked.targets.length} frame ${directionText}` +
        (operation?.type === "edge" ? " · giữ các cạnh và box khác; thiếu box tương ứng thì thêm box nguồn đã chỉnh" :
          operationMode ? " · giữ nguyên các box/cạnh còn lại" : ` · ${writeText}`) +
        (skipped ? ` · bỏ qua ${skipped} frame đã Done` : "") + ". Tối đa 4 request chạy song song.";
    }
    dialog.querySelector(".nl-apply").disabled = Boolean(picked.error) || !sourceCount || state.operationBusy;
  }

  function openEyeBulkDialog() {
    if (state.operationBusy) return;
    const context = currentEyeClipContext();
    if (!context) {
      notify("Hãy mở một frame eye 15pt trong clip trước");
      return;
    }
    if (!context.sourceItems.length) {
      notify("Frame hiện tại không có eye 15pt để sao chép");
      return;
    }
    state.eyeBulkContext = context;
    const dialog = ensureEyeBulkDialog();
    dialog.querySelector(`input[name="nl-eye-scope"][value="${context.selected.length ? "selected" : "all"}"]`).checked = true;
    updateEyeBulkDialog();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".nl-count").focus();
    dialog.querySelector(".nl-count").select();
  }

  function openGenericBulkDialog() {
    if (state.operationBusy) return;
    if (QUICK_BBOX_LABELS.has(S.labelSel)) syncBboxMarkedScope();
    if (state.eyeBulkDirection === "marked" &&
        (!bboxMarkedScopeMatches() || !state.bboxMarkedFrames.size)) state.eyeBulkDirection = "after";
    const context = currentGenericClipContext();
    if (!context) {
      notify("Hãy mở một frame thuộc clip trước khi sao chép");
      return;
    }
    if (!context.sourceItems.length && !context.operation) {
      notify(`Frame hiện tại không có ${context.labelName} để sao chép`);
      return;
    }
    state.eyeBulkContext = context;
    const dialog = ensureEyeBulkDialog();
    dialog.querySelector(`input[name="nl-eye-scope"][value="${context.selected.length ? "selected" : "all"}"]`).checked = true;
    updateEyeBulkDialog();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".nl-count").focus();
    dialog.querySelector(".nl-count").select();
  }

  function currentClipContext() {
    if (!pageLabelingReady("seatbelt")) return null;
    const current = state.list?.querySelector(`li[data-g="${S.shownG}"]`) || state.list?.querySelector("li.cur");
    const details = current?.closest(".nl-clip");
    if (!details) return null;
    const frames = Array.from(details.querySelectorAll("li[data-g]"))
      .map((li) => Number(li.dataset.g))
      .filter(Number.isInteger);
    const source = Number(current.dataset.g);
    const sourceIndex = frames.indexOf(source);
    if (sourceIndex < 0) return null;
    return {
      details,
      frames,
      source,
      sourceIndex,
      clip: details.dataset.clip || "clip",
      generation: S.gen,
      sourceKey: typeof rvKey === "function" ? rvKey(source) : ""
    };
  }

  function ensureBulkDialog() {
    if (state.bulkDialog?.isConnected) return state.bulkDialog;
    const dialog = document.createElement("dialog");
    dialog.id = "nl-seatbelt-bulk";
    dialog.className = "nl-bulk-dialog";
    dialog.innerHTML = `
      <form class="nl-modal" method="dialog">
        <h2>Chồng segment seatbelt theo clip</h2>
        <p class="nl-sub"></p>

        <p class="nl-status-only" hidden></p>

        <span class="nl-label nl-mask-only">Hướng áp dụng</span>
        <div class="nl-choice nl-directions nl-mask-only">
          <button type="button" data-direction="before">← Các frame trước</button>
          <button type="button" data-direction="after">Các frame sau →</button>
        </div>

        <span class="nl-label nl-scope-label nl-mask-only">Phần segment cần chồng</span>
        <div class="nl-scope nl-mask-only">
          <label class="nl-patch-option"><input type="radio" name="nl-scope" value="patch"><span class="nl-patch-label">Chỉ polygon vừa vẽ</span></label>
          <label class="nl-mask-option"><input type="radio" name="nl-scope" value="mask"> Toàn bộ segment của frame hiện tại</label>
        </div>

        <label class="nl-label nl-mask-only" for="nl-bulk-count">Số frame đích hoặc end</label>
        <input id="nl-bulk-count" class="nl-count nl-mask-only" value="1" autocomplete="off" spellcheck="false">
        <div class="nl-preview" aria-live="polite"></div>

        <div class="nl-actions">
          <button type="button" class="nl-cancel">Hủy · Esc</button>
          <button type="button" class="primary nl-apply">Áp dụng · Enter</button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);

    for (const button of dialog.querySelectorAll("[data-direction]")) {
      button.addEventListener("click", () => {
        state.bulkDirection = button.dataset.direction;
        updateBulkDialog();
      });
    }
    dialog.querySelector(".nl-count").addEventListener("input", updateBulkDialog);
    for (const input of dialog.querySelectorAll('input[name="nl-scope"]')) {
      input.addEventListener("change", updateBulkDialog);
    }
    dialog.querySelector(".nl-cancel").addEventListener("click", cancelBulkDialog);
    dialog.querySelector(".nl-apply").addEventListener("click", applyBulkAction);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancelBulkDialog();
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.tagName !== "BUTTON") {
        event.preventDefault();
        applyBulkAction();
      }
    });
    dialog.addEventListener("close", () => {
      if (!dialog.open) {
        state.bulkContext = null;
        state.bulkMode = null;
        if (dialog.contains(document.activeElement)) document.activeElement.blur();
      }
    });
    state.bulkDialog = dialog;
    return dialog;
  }

  function cancelBulkDialog() {
    if (state.operationBusy) return;
    if (state.bulkMode === "mask") cancelManualMode();
    state.bulkContext = null;
    if (state.bulkDialog?.contains(document.activeElement)) document.activeElement.blur();
    state.bulkDialog?.close();
  }

  function selectedBulkTargets() {
    const context = state.bulkContext;
    if (!context) return { targets: [], error: "Không xác định được clip hiện tại." };
    const dialog = state.bulkDialog;
    const raw = dialog.querySelector(".nl-count").value.trim().toLowerCase();
    const candidates = state.bulkDirection === "before"
      ? context.frames.slice(0, context.sourceIndex).reverse()
      : context.frames.slice(context.sourceIndex + 1);
    let count;
    if (raw === "end") count = candidates.length;
    else if (/^[1-9]\d*$/.test(raw)) count = Number(raw);
    else return { targets: [], error: "Nhập số nguyên lớn hơn 0 hoặc end." };
    const selected = candidates.slice(0, count);
    if (!selected.length) return { targets: [], error: "Không còn frame nào theo hướng đã chọn trong clip này." };
    return { targets: selected, error: "" };
  }

  function updateBulkDialog() {
    const dialog = state.bulkDialog;
    const context = state.bulkContext;
    if (!dialog || !context) return;
    const statusMode = state.bulkMode === "status";
    dialog.classList.toggle("nl-status-mode", statusMode);
    dialog.classList.toggle("nl-subtract", false);
    for (const element of dialog.querySelectorAll(".nl-mask-only")) element.hidden = statusMode;
    const statusOnly = dialog.querySelector(".nl-status-only");
    statusOnly.hidden = !statusMode;
    if (statusMode) {
      const selected = Array.from(state.markedFrames);
      const targets = selected.filter((g) => frameState(g) === "done");
      dialog.querySelector("h2").textContent = "Chuyển frame đã chọn sang In progress";
      dialog.querySelector(".nl-sub").textContent =
        `${context.label} · ${selected.length} frame đã chọn. Mask và tag hiện có được giữ nguyên.`;
      statusOnly.textContent = "Các frame sau khi mở lại có thể chỉnh sửa bình thường.";
      const preview = dialog.querySelector(".nl-preview");
      preview.classList.toggle("err", !targets.length);
      preview.textContent = targets.length
        ? `Chuyển ${targets.length} frame từ Done sang In progress. Tối đa 4 request chạy song song.`
        : "Không còn frame Done nào trong danh sách đã chọn.";
      const apply = dialog.querySelector(".nl-apply");
      apply.textContent = "Chuyển In progress · Enter";
      apply.disabled = !targets.length || state.operationBusy;
      return;
    }
    dialog.querySelector(".nl-apply").textContent = "Áp dụng · Enter";
    for (const button of dialog.querySelectorAll("[data-direction]")) {
      button.classList.toggle("on", button.dataset.direction === state.bulkDirection);
    }

    const hasPatch = patchMatchesContext(context);
    const subtract = hasPatch && state.lastPatch.operation === "subtract";
    const samPatch = hasPatch && state.lastPatch.kind === "sam";
    const patchOption = dialog.querySelector(".nl-patch-option");
    patchOption.hidden = !hasPatch;
    dialog.querySelector(".nl-mask-option").hidden = subtract;
    dialog.querySelector('.nl-mask-option input').disabled = subtract;
    dialog.querySelector(".nl-patch-label").textContent = samPatch
      ? (subtract ? "Chỉ phần mask vừa xóa (SAM3)" : "Chỉ phần mask mới thêm (SAM3)")
      : (subtract ? "Vùng polygon đỏ cần xóa" : "Chỉ polygon vừa vẽ");
    dialog.classList.toggle("nl-subtract", subtract);
    dialog.querySelector("h2").textContent = subtract ? "Xóa vùng seatbelt trên nhiều frame" : "Chồng segment seatbelt theo clip";
    dialog.querySelector(".nl-scope-label").textContent = subtract ? "Vùng cần xóa" : "Phần segment cần chồng";
    const checked = dialog.querySelector('input[name="nl-scope"]:checked');
    if (subtract || !checked || (checked.value === "patch" && !hasPatch)) {
      dialog.querySelector(`input[name="nl-scope"][value="${hasPatch ? "patch" : "mask"}"]`).checked = true;
    }

    dialog.querySelector(".nl-sub").textContent =
      `${context.clip} · nguồn frame ${context.sourceIndex + 1}/${context.frames.length}. ` +
      (subtract
        ? (samPatch ? "Chỉ xóa phần vừa sửa bằng SAM3; giữ phần seatbelt bên ngoài." : "Chỉ xóa mask bên trong polygon đỏ; giữ phần seatbelt bên ngoài.")
        : "Segment cũ ở frame đích được giữ nguyên.");
    const picked = selectedBulkTargets();
    const emptySamPatch = samPatch && !state.lastPatch.pixelCount &&
      dialog.querySelector('input[name="nl-scope"]:checked')?.value === "patch";
    const preview = dialog.querySelector(".nl-preview");
    preview.classList.toggle("err", Boolean(picked.error) || emptySamPatch);
    if (picked.error) preview.textContent = picked.error;
    else if (emptySamPatch) preview.textContent = subtract
      ? "SAM3 chưa xóa thêm pixel nào ở frame hiện tại. Hãy chọn lại vùng cần xóa."
      : "SAM3 chưa thêm pixel mới ở frame hiện tại. Chọn toàn bộ segment nếu muốn chồng mask hiện có.";
    else {
      const skipped = picked.targets.filter((g) => frameState(g) === "done").length;
      const action = subtract ? (samPatch ? "Xóa vùng SAM3 trên" : "Xóa vùng đỏ trên") :
        (samPatch && dialog.querySelector('input[name="nl-scope"]:checked')?.value === "patch" ? "Chồng phần mask mới thêm vào" : "Chồng segment vào");
      preview.textContent = `${action} ${picked.targets.length} frame đích · ${state.bulkDirection === "after" ? "sau" : "trước"} frame hiện tại` +
        (skipped ? ` · bỏ qua ${skipped} frame đã Done` : "") + ". Tối đa 4 request chạy song song.";
    }
    dialog.querySelector(".nl-apply").disabled = Boolean(picked.error) || emptySamPatch || state.operationBusy;
  }

  function openBulkDialog() {
    if (state.operationBusy) return;
    syncMarkedScope();
    if (state.markedFrames.size) {
      state.bulkMode = "status";
      state.bulkContext = {
        generation: S.gen,
        session: S.sess,
        label: S.labelSel
      };
      const dialog = ensureBulkDialog();
      updateBulkDialog();
      if (!dialog.open) dialog.showModal();
      dialog.querySelector(".nl-apply").focus();
      return;
    }
    if (S.labelSel === "eye_lmk") {
      openEyeBulkDialog();
      return;
    }
    if (GENERIC_COPY_LABELS.has(S.labelSel)) {
      openGenericBulkDialog();
      return;
    }
    const context = currentClipContext();
    if (!context) {
      notify("Hãy mở một frame seatbelt trong clip trước");
      return;
    }
    if (typeof BT !== "undefined") {
      if (state.manualMode && BT.poly.length) {
        notify("Hãy khép polygon trước khi Ctrl+B, hoặc nhấn Esc để hủy vùng đang vẽ");
        return;
      }
      if (BT.busy) {
        notify("SAM3 đang tạo mask. Hãy chờ kết quả rồi nhấn R để thêm mask trước khi Ctrl+B");
        return;
      }
      if (BT.prev || BT.points.length) {
        notify("Nhấn R để thêm vùng xanh SAM3 trước khi Ctrl+B, hoặc Esc để hủy bản xem trước");
        return;
      }
    }
    state.bulkMode = "mask";
    state.bulkContext = context;
    const dialog = ensureBulkDialog();
    dialog.querySelector(`input[name="nl-scope"][value="${patchMatchesContext(context) ? "patch" : "mask"}"]`).checked = true;
    updateBulkDialog();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".nl-count").focus();
    dialog.querySelector(".nl-count").select();
  }

  function decodeRle(counts, size) {
    const mask = new Uint8Array(size);
    let position = 0;
    let value = 0;
    for (const count of counts || []) {
      if (value) mask.fill(1, position, Math.min(size, position + count));
      position += count;
      value ^= 1;
      if (position >= size) break;
    }
    return mask;
  }

  function encodeRle(mask) {
    const counts = [];
    let value = 0;
    let run = 0;
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index] !== value) {
        counts.push(run);
        run = 0;
        value ^= 1;
      }
      run += 1;
    }
    counts.push(run);
    return counts;
  }

  function polygonsToMask(items, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    for (const item of items || []) {
      for (const polygon of item.poly || []) {
        if (polygon.length < 6) continue;
        context.beginPath();
        for (let index = 0; index < polygon.length; index += 2) {
          context[index ? "lineTo" : "moveTo"](polygon[index], polygon[index + 1]);
        }
        context.closePath();
        context.fill();
      }
    }
    const pixels = context.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let index = 0; index < mask.length; index += 1) mask[index] = pixels[index * 4 + 3] > 127 ? 1 : 0;
    return mask;
  }

  async function loadAutoLabel(segmentIndex) {
    let data = S.al.get(segmentIndex);
    if (data instanceof Promise) {
      await data;
      data = S.al.get(segmentIndex);
    } else if (data === undefined && typeof ensureAL === "function") {
      const loading = ensureAL(segmentIndex);
      if (loading instanceof Promise) await loading;
      data = S.al.get(segmentIndex);
    }
    return data && !(data instanceof Promise) ? data : null;
  }

  async function getFrameMask(g, expectedGeneration) {
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const width = S.sess.src_w;
    const height = S.sess.src_h;
    const key = rvKey(g);
    const saved = S.ledits?.[key]?.seatbelt;
    if (saved) {
      const mask = new Uint8Array(width * height);
      for (const item of saved) {
        const decoded = decodeRle(item.rle?.counts, mask.length);
        for (let index = 0; index < mask.length; index += 1) if (decoded[index]) mask[index] = 1;
      }
      return mask;
    }

    const [segmentIndex, frameIndex] = loc(g);
    const autoLabel = await loadAutoLabel(segmentIndex);
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const frame = autoLabel?.frames?.[String(frameIndex)];
    return polygonsToMask(frame?.sam?.seatbelt || [], width, height);
  }

  async function saveFrameMask(g, mask, expectedGeneration) {
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const [segmentIndex, frameIndex] = loc(g);
    const segment = S.sess.segments[segmentIndex];
    const key = rvKey(g);
    const items = [{ rle: { size: [S.sess.src_h, S.sess.src_w], counts: encodeRle(mask) } }];
    await requestJson("/api/label_edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: S.sess.bucket,
        prefix: segPfx(segmentIndex),
        seg: segment.name,
        i: frameIndex,
        t: Math.round(S.ts[g] || 0),
        label: "seatbelt",
        items
      })
    });
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    (S.ledits[key] = S.ledits[key] || {}).seatbelt = items;
    try { if (typeof _beltCache !== "undefined") _beltCache.delete(key); } catch (_) {}
    if (frameState(g) === "todo") await saveFrameState(g, "seatbelt", "wip", expectedGeneration);
  }

  async function getFrameEyeItems(g, expectedGeneration) {
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const key = rvKey(g);
    const saved = S.ledits?.[key]?.eye_lmk;
    if (saved) return cloneEyeItems(saved);
    const [segmentIndex, frameIndex] = loc(g);
    const autoLabel = await loadAutoLabel(segmentIndex);
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const frame = autoLabel?.frames?.[String(frameIndex)];
    return frame && typeof alBoxes === "function" ? cloneEyeItems(alBoxes(frame, "eye_lmk")) : [];
  }

  function sameEyeItem(left, right) {
    if (!Array.isArray(left?.pts) || !Array.isArray(right?.pts) || left.pts.length !== right.pts.length) return false;
    if (Boolean(left.closed) !== Boolean(right.closed)) return false;
    return left.pts.every((point, index) => {
      const other = right.pts[index];
      if (!point || !other) return point === other;
      return Math.abs(point[0] - other[0]) < 0.05 && Math.abs(point[1] - other[1]) < 0.05;
    });
  }

  async function saveFrameEyeItems(g, items, expectedGeneration) {
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const [segmentIndex, frameIndex] = loc(g);
    const segment = S.sess.segments[segmentIndex];
    const key = rvKey(g);
    const round = (value) => Math.round(Number(value) * 10) / 10;
    const savedItems = cloneEyeItems(items).map((item) => ({
      pts: item.pts.map((point) => point ? [round(point[0]), round(point[1])] : null),
      ...(item.closed ? { closed: true } : {})
    }));
    await requestJson("/api/label_edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: S.sess.bucket,
        prefix: segPfx(segmentIndex),
        seg: segment.name,
        i: frameIndex,
        t: Math.round(S.ts[g] || 0),
        label: "eye_lmk",
        items: savedItems
      })
    });
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    (S.ledits[key] = S.ledits[key] || {}).eye_lmk = savedItems;
    if (frameState(g) === "todo") await saveFrameState(g, "eye_lmk", "wip", expectedGeneration);
  }

  async function getFrameGenericItems(g, label, expectedGeneration) {
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const key = rvKey(g);
    const saved = S.ledits?.[key]?.[label];
    if (saved) return cloneGenericItems(saved);
    const [segmentIndex, frameIndex] = loc(g);
    const autoLabel = await loadAutoLabel(segmentIndex);
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const frame = autoLabel?.frames?.[String(frameIndex)];
    return frame && typeof alBoxes === "function" ? cloneGenericItems(alBoxes(frame, label)) : [];
  }

  async function saveFrameGenericItems(g, label, items, expectedGeneration) {
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    const [segmentIndex, frameIndex] = loc(g);
    const segment = S.sess.segments[segmentIndex];
    const key = rvKey(g);
    const round = (value) => Math.round(Number(value) * 10) / 10;
    const savedItems = cloneGenericItems(items).map((item) => item.pts
      ? {
          pts: item.pts.map((point) => point ? [round(point[0]), round(point[1])] : null),
          ...(item.closed ? { closed: true } : {})
        }
      : { box: item.box.map(round), ...(item.cls ? { cls: item.cls } : {}) });
    await requestJson("/api/label_edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: S.sess.bucket,
        prefix: segPfx(segmentIndex),
        seg: segment.name,
        i: frameIndex,
        t: Math.round(S.ts[g] || 0),
        label,
        items: savedItems
      })
    });
    if (S.gen !== expectedGeneration) throw new Error("Session đã thay đổi");
    (S.ledits[key] = S.ledits[key] || {})[label] = savedItems;
    if (frameState(g) === "todo") await saveFrameState(g, label, "wip", expectedGeneration);
  }

  function sameGenericItem(left, right) {
    const a = cloneGenericItems([left])[0];
    const b = cloneGenericItems([right])[0];
    return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
  }

  function bboxIntersectionOverUnion(left, right) {
    if (!Array.isArray(left) || left.length < 4 || !Array.isArray(right) || right.length < 4) return 0;
    const a = left.slice(0, 4).map(Number);
    const b = right.slice(0, 4).map(Number);
    if (!a.every(Number.isFinite) || !b.every(Number.isFinite)) return 0;
    const ax1 = Math.min(a[0], a[2]);
    const ay1 = Math.min(a[1], a[3]);
    const ax2 = Math.max(a[0], a[2]);
    const ay2 = Math.max(a[1], a[3]);
    const bx1 = Math.min(b[0], b[2]);
    const by1 = Math.min(b[1], b[3]);
    const bx2 = Math.max(b[0], b[2]);
    const by2 = Math.max(b[1], b[3]);
    const intersection = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1)) *
      Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
    const union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - intersection;
    return union > 0 ? intersection / union : 0;
  }

  function bboxIntersectionOverSmaller(left, right) {
    if (!Array.isArray(left) || left.length < 4 || !Array.isArray(right) || right.length < 4) return 0;
    const a = left.slice(0, 4).map(Number);
    const b = right.slice(0, 4).map(Number);
    if (!a.every(Number.isFinite) || !b.every(Number.isFinite)) return 0;
    const ax1 = Math.min(a[0], a[2]);
    const ay1 = Math.min(a[1], a[3]);
    const ax2 = Math.max(a[0], a[2]);
    const ay2 = Math.max(a[1], a[3]);
    const bx1 = Math.min(b[0], b[2]);
    const by1 = Math.min(b[1], b[3]);
    const bx2 = Math.max(b[0], b[2]);
    const by2 = Math.max(b[1], b[3]);
    const intersection = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1)) *
      Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
    const smallerArea = Math.min((ax2 - ax1) * (ay2 - ay1), (bx2 - bx1) * (by2 - by1));
    return smallerArea > 0 ? intersection / smallerArea : 0;
  }

  function bboxDimensionSimilarity(left, right) {
    if (!Array.isArray(left) || left.length < 4 || !Array.isArray(right) || right.length < 4) return null;
    const a = left.slice(0, 4).map(Number);
    const b = right.slice(0, 4).map(Number);
    if (!a.every(Number.isFinite) || !b.every(Number.isFinite)) return null;
    const widthA = Math.abs(a[2] - a[0]);
    const heightA = Math.abs(a[3] - a[1]);
    const widthB = Math.abs(b[2] - b[0]);
    const heightB = Math.abs(b[3] - b[1]);
    if (!widthA || !heightA || !widthB || !heightB) return null;
    const width = Math.min(widthA, widthB) / Math.max(widthA, widthB);
    const height = Math.min(heightA, heightB) / Math.max(heightA, heightB);
    return { min: Math.min(width, height), max: Math.max(width, height) };
  }

  function bboxCopyMatchScore(target, source) {
    if (target?.cls && source?.cls && target.cls !== source.cls) return 0;
    const size = bboxDimensionSimilarity(target?.box, source?.box);
    if (!size) return 0;
    const iou = bboxIntersectionOverUnion(target.box, source.box);
    if (iou >= BBOX_COPY_MATCH_IOU_THRESHOLD) return iou;
    const containment = bboxIntersectionOverSmaller(target.box, source.box);
    // A box can need a substantial correction along just one axis. Tiny boxes
    // that differ in both dimensions remain separate annotations.
    const similarSize = size.min >= BBOX_COPY_MATCH_SIZE_THRESHOLD ||
      (size.min >= BBOX_COPY_MATCH_NARROW_AXIS_THRESHOLD && size.max >= BBOX_COPY_MATCH_LONG_AXIS_THRESHOLD);
    return containment >= BBOX_COPY_MATCH_CONTAINMENT_THRESHOLD && similarSize ? iou : 0;
  }

  function findGenericBboxMatches(targetItems, candidates, sourceItems = []) {
    // Compare against the other source boxes before replacing anything. An
    // enclosing body can overlap the selected inner box yet belong to a much
    // better match in the source layout. Nearly coincident source duplicates
    // belong to the selected copy, so they must not protect old target boxes.
    // This grouping is separate from the 90% IoU threshold for red warnings.
    const otherSources = sourceItems.filter((item) => candidates.every((candidate) =>
      (item?.cls && candidate.cls && item.cls !== candidate.cls) ||
      bboxIntersectionOverUnion(item?.box, candidate.box) < BBOX_COPY_DUPLICATE_IOU_THRESHOLD));
    const matches = [];
    targetItems.forEach((item, index) => {
      const score = Math.max(0, ...candidates.map((candidate) => bboxCopyMatchScore(item, candidate)));
      if (!score || otherSources.some((other) => bboxCopyMatchScore(item, other) >= score - 1e-9)) return;
      matches.push({ index, score });
    });
    return matches;
  }

  function mergeCopiedGenericBbox(targetItems, sourceItem, sourceItems = []) {
    const nextItems = cloneGenericItems(targetItems);
    const added = cloneGenericItems([sourceItem])[0];
    if (!added) return nextItems;
    if (!Array.isArray(added.box)) {
      if (!nextItems.some((item) => sameGenericItem(item, added))) nextItems.push(added);
      return nextItems;
    }
    const matchingIndexes = findGenericBboxMatches(nextItems, [added], sourceItems).map((match) => match.index);
    if (!matchingIndexes.length) {
      nextItems.push(added);
      return nextItems;
    }
    const matched = new Set(matchingIndexes);
    const first = matchingIndexes[0];
    return nextItems.flatMap((item, index) => index === first ? [added] : matched.has(index) ? [] : [item]);
  }

  function eyeCenterX(item) {
    const points = item?.pts?.filter((point) => Array.isArray(point));
    return points?.length ? points.reduce((sum, point) => sum + point[0], 0) / points.length : Infinity;
  }

  function mergeEyeLandmarks(targetItems, sourceItems, context, scope) {
    const nextItems = cloneEyeItems(targetItems);
    const sourceOrder = context.sourceItems
      .map((item, index) => ({ index, x: eyeCenterX(item) }))
      .sort((left, right) => left.x - right.x)
      .map((entry) => entry.index);
    const targetOrder = nextItems
      .map((item, index) => ({ index, x: eyeCenterX(item) }))
      .sort((left, right) => left.x - right.x)
      .map((entry) => entry.index);
    const sourceIndexes = scope === "selected" ? context.selected : sourceOrder;
    for (const sourceIndex of sourceIndexes) {
      const source = context.sourceItems[sourceIndex];
      const copy = cloneEyeItems([source])[0];
      if (!copy) continue;
      const rank = sourceOrder.indexOf(sourceIndex);
      const targetIndex = targetOrder[rank];
      if (targetIndex === undefined) {
        if (!nextItems.some((existing) => sameEyeItem(existing, copy))) nextItems.push(copy);
      } else {
        nextItems[targetIndex] = copy;
      }
    }
    return nextItems;
  }

  async function applyEyeBulkCopy() {
    if (state.operationBusy || !pageLabelingReady("eye_lmk")) return;
    const context = state.eyeBulkContext;
    const picked = selectedEyeBulkTargets();
    if (!context || context.generation !== S.gen || picked.error) {
      updateEyeBulkDialog();
      return;
    }
    const targets = picked.targets.filter((g) => frameState(g) !== "done");
    if (!targets.length) {
      notify("Các frame đã chọn đều đang ở trạng thái Done");
      return;
    }
    const dialog = state.eyeBulkDialog;
    const preview = dialog.querySelector(".nl-preview");
    const apply = dialog.querySelector(".nl-apply");
    const scope = dialog.querySelector('input[name="nl-eye-scope"]:checked')?.value || "all";
    const writeMode = dialog.querySelector('input[name="nl-eye-write"]:checked')?.value || "merge";
    const sourceItems = scope === "selected"
      ? context.selected.map((index) => context.sourceItems[index]).filter(Boolean)
      : context.sourceItems;
    if (!sourceItems.length) {
      updateEyeBulkDialog();
      return;
    }
    state.operationBusy = true;
    apply.disabled = true;
    try {
      const result = await runQueue(targets, async (g) => {
        const currentItems = writeMode === "replace" ? [] : await getFrameEyeItems(g, context.generation);
        let nextItems;
        if (writeMode === "merge") {
          nextItems = mergeEyeLandmarks(currentItems, sourceItems, context, scope);
        } else {
          nextItems = cloneEyeItems(sourceItems);
        }
        await saveFrameEyeItems(g, nextItems, context.generation);
      }, (done, total) => {
        preview.classList.remove("err");
        preview.textContent = `Đang sao chép ${done}/${total} frame…`;
      }, 4);
      if (typeof fsRender === "function" && S.gen === context.generation) fsRender();
      if (typeof paint === "function" && S.gen === context.generation) paint();
      if (result.error) throw new Error(`đã lưu ${result.completed}/${targets.length}: ${result.error.message}`);
      dialog.close();
      notify(`Đã sao chép ${sourceItems.length} cụm eye 15pt vào ${targets.length} frame. Kéo bên trong khung nét đứt để di chuyển cả mắt.`);
    } catch (error) {
      preview.classList.add("err");
      preview.textContent = `Dừng vì lỗi: ${error.message}`;
    } finally {
      state.operationBusy = false;
      if (apply.isConnected) apply.disabled = false;
    }
  }

  function applyItemBulkCopy() {
    if (state.eyeBulkContext?.label === "eye_lmk") applyEyeBulkCopy();
    else applyGenericBulkCopy();
  }

  function applyQuickOperationToItems(items, operation, sourceItems = []) {
    const next = cloneGenericItems(items);
    const order = bboxHorizontalOrder(next);
    if (operation.type === "delete") {
      if (operation.selector === "all") return [];
      if (operation.selector === "region" && Array.isArray(operation.region)) {
        return next.filter((item) => {
          try { return !(Array.isArray(item?.box) && typeof boxInPoly === "function" && boxInPoly(item.box, operation.region)); }
          catch (_) { return true; }
        });
      }
      let rank = operation.selector === "left" ? 0 : operation.selector === "right" ? order.length - 1 : operation.rank;
      rank = Math.max(0, Math.min(order.length - 1, Number(rank)));
      if (order[rank]) next.splice(order[rank].index, 1);
      return next;
    }
    if (operation.type === "edge") {
      const coord = Number(operation.coord);
      const value = Number(operation.value);
      const width = Number(S.sess?.src_w) || 0;
      const height = Number(S.sess?.src_h) || 0;
      if (![0, 1, 2, 3].includes(coord) || !Number.isFinite(value) || !width || !height ||
          !bboxDimensionSimilarity(operation.originalBox, operation.currentBox)) return next;
      const source = sourceItems[operation.itemIndex] || {};
      const original = cloneGenericItems([{ ...source, box: operation.originalBox }])[0];
      const current = cloneGenericItems([{ ...source, box: operation.currentBox }])[0];
      // Dragging a single edge can change width/height drastically. Match
      // either the original or edited geometry, never the left/right rank.
      const matches = findGenericBboxMatches(next, [original, current], sourceItems);
      const best = matches.reduce((chosen, match) => !chosen || match.score > chosen.score ? match : chosen, null);
      const target = best ? next[best.index] : current;
      target.box[coord] = value;
      if (coord === 0) target.box[0] = Math.max(0, Math.min(target.box[2] - 1, target.box[0]));
      if (coord === 1) target.box[1] = Math.max(0, Math.min(target.box[3] - 1, target.box[1]));
      if (coord === 2) target.box[2] = Math.min(width, Math.max(target.box[0] + 1, target.box[2]));
      if (coord === 3) target.box[3] = Math.min(height, Math.max(target.box[1] + 1, target.box[3]));
      if (!best) {
        next.push(target);
      } else {
        const duplicates = new Set(matches.filter((match) => match.index !== best.index).map((match) => match.index));
        return next.filter((_, index) => !duplicates.has(index));
      }
    }
    return next;
  }

  async function applyGenericBulkCopy() {
    const context = state.eyeBulkContext;
    if (state.operationBusy || !context || !GENERIC_COPY_LABELS.has(context.label) ||
        !pageLabelingReady(context.label)) return;
    const picked = selectedEyeBulkTargets();
    if (context.generation !== S.gen || context.label !== S.labelSel || picked.error) {
      updateEyeBulkDialog();
      return;
    }
    const targets = picked.targets.filter((g) => frameState(g) !== "done");
    if (!targets.length) {
      notify("Các frame đã chọn đều đang ở trạng thái Done");
      return;
    }
    const dialog = state.eyeBulkDialog;
    const preview = dialog.querySelector(".nl-preview");
    const apply = dialog.querySelector(".nl-apply");
    const scope = dialog.querySelector('input[name="nl-eye-scope"]:checked')?.value || "all";
    const operation = context.operation;
    const operationMode = operation?.type === "delete" || operation?.type === "edge";
    const sourceItems = scope === "selected"
      ? context.selected.map((index) => context.sourceItems[index]).filter(Boolean)
      : context.sourceItems;
    if (!sourceItems.length && !operationMode) {
      updateEyeBulkDialog();
      return;
    }
    state.operationBusy = true;
    apply.disabled = true;
    try {
      const undoFrames = [];
      const result = await runQueue(targets, async (g) => {
        let nextItems;
        const currentItems = await getFrameGenericItems(g, context.label, context.generation);
        undoFrames.push({ g, items: cloneGenericItems(currentItems) });
        if (operationMode) {
          nextItems = applyQuickOperationToItems(currentItems, operation, context.sourceItems);
        } else if (scope === "selected") {
          const added = cloneGenericItems(sourceItems)[0];
          nextItems = mergeCopiedGenericBbox(currentItems, added, context.sourceItems);
        } else {
          nextItems = cloneGenericItems(sourceItems);
        }
        await saveFrameGenericItems(g, context.label, nextItems, context.generation);
      }, (done, total) => {
        preview.classList.remove("err");
        preview.textContent = `Đang sao chép ${done}/${total} frame…`;
      }, 4);
      if (typeof fsRender === "function" && S.gen === context.generation) fsRender();
      if (typeof paint === "function" && S.gen === context.generation) paint();
      if (QUICK_BBOX_LABELS.has(context.label) && undoFrames.length) rememberBboxUndo(undoFrames, true);
      if (result.error) throw new Error(`đã lưu ${result.completed}/${targets.length}: ${result.error.message}`);
      dialog.close();
      notify(operation?.type === "delete"
        ? `Đã xóa box ${context.labelName} trên ${targets.length} frame`
        : operation?.type === "edge"
          ? `Đã chỉnh riêng cạnh ${operation.edge} của body trên ${targets.length} frame`
          : `Đã sao chép ${sourceItems.length} đối tượng ${context.labelName} vào ${targets.length} frame`);
    } catch (error) {
      preview.classList.add("err");
      preview.textContent = `Dừng vì lỗi: ${error.message}`;
    } finally {
      state.operationBusy = false;
      if (apply.isConnected) apply.disabled = false;
    }
  }

  function applyBulkAction() {
    if (state.bulkMode === "status") applySelectedInProgress();
    else applyBulkCopy();
  }

  async function applySelectedInProgress() {
    if (state.operationBusy || !pageLabelingReady()) return;
    const context = state.bulkContext;
    if (!context || context.generation !== S.gen || context.session !== S.sess || context.label !== S.labelSel) {
      updateBulkDialog();
      return;
    }
    const targets = Array.from(state.markedFrames).filter((g) => frameState(g) === "done");
    if (!targets.length) {
      updateBulkDialog();
      return;
    }
    const dialog = state.bulkDialog;
    const preview = dialog.querySelector(".nl-preview");
    const apply = dialog.querySelector(".nl-apply");
    state.operationBusy = true;
    apply.disabled = true;

    try {
      const result = await runQueue(targets, async (g) => {
        await saveFrameState(g, context.label, "wip", context.generation);
        state.markedFrames.delete(g);
      }, (done, total) => {
        preview.classList.remove("err");
        preview.textContent = `Đang chuyển ${done}/${total} frame sang In progress…`;
      }, 4);
      if (typeof fsRender === "function" && S.gen === context.generation) fsRender();
      updateMarkedUI();
      if (result.error) throw new Error(`đã chuyển ${result.completed}/${targets.length}: ${result.error.message}`);
      dialog.close();
      notify(`Đã chuyển ${targets.length} frame sang In progress`);
    } catch (error) {
      preview.classList.add("err");
      preview.textContent = `Dừng vì lỗi: ${error.message}. Các frame chưa chuyển vẫn được giữ trong danh sách chọn.`;
    } finally {
      state.operationBusy = false;
      if (apply.isConnected && dialog.open) {
        apply.disabled = !Array.from(state.markedFrames).some((g) => frameState(g) === "done");
      }
    }
  }

  async function applyBulkCopy() {
    if (state.operationBusy || !pageLabelingReady("seatbelt")) return;
    const context = state.bulkContext;
    const picked = selectedBulkTargets();
    if (!context || picked.error) {
      updateBulkDialog();
      return;
    }
    const targets = picked.targets.filter((g) => frameState(g) !== "done");
    if (!targets.length) {
      notify("Các frame đã chọn đều đang ở trạng thái Done");
      return;
    }

    const dialog = state.bulkDialog;
    const preview = dialog.querySelector(".nl-preview");
    const apply = dialog.querySelector(".nl-apply");
    const scope = dialog.querySelector('input[name="nl-scope"]:checked')?.value || "mask";
    state.operationBusy = true;
    apply.disabled = true;

    try {
      let sourceMask;
      let operation = "add";
      if (scope === "patch" && patchMatchesContext(context)) {
        sourceMask = state.lastPatch.mask.slice();
        operation = state.lastPatch.operation;
      } else {
        sourceMask = await getFrameMask(context.source, context.generation);
      }
      let hasPixels = false;
      for (const value of sourceMask) if (value) { hasPixels = true; break; }
      if (!hasPixels) throw new Error(scope === "patch" ? "Vùng vừa sửa không có pixel để áp dụng" : "Frame nguồn không có segment để chồng");

      const result = await runQueue(targets, async (g) => {
        const targetMask = await getFrameMask(g, context.generation);
        for (let index = 0; index < targetMask.length; index += 1) {
          if (!sourceMask[index]) continue;
          targetMask[index] = operation === "subtract" ? 0 : 1;
        }
        await saveFrameMask(g, targetMask, context.generation);
      }, (done, total) => {
        preview.classList.remove("err");
        preview.textContent = `Đang lưu ${done}/${total} frame…`;
      }, 4);

      if (typeof fsRender === "function" && S.gen === context.generation) fsRender();
      if (typeof paint === "function" && S.gen === context.generation) paint();
      if (result.error) throw new Error(`đã lưu ${result.completed}/${targets.length}: ${result.error.message}`);
      dialog.close();
      notify(`${operation === "subtract" ? "Đã xóa vùng seatbelt trên" : "Đã chồng segment vào"} ${targets.length} frame trong ${context.clip}`);
    } catch (error) {
      preview.classList.add("err");
      preview.textContent = `Dừng vì lỗi: ${error.message}`;
    } finally {
      state.operationBusy = false;
      if (apply.isConnected) apply.disabled = false;
    }
  }

  function manualPolygonAvailable() {
    try {
      return pageLabelingReady("seatbelt") && typeof BT !== "undefined" && typeof beltLoad === "function" &&
        typeof beltActive === "function" && beltActive() && beltLoad();
    } catch (_) {
      return false;
    }
  }

  function patchMatchesContext(context) {
    return Boolean(state.lastPatch && state.lastPatch.key === context.sourceKey &&
      state.lastPatch.generation === context.generation);
  }

  function ensureNativeEditing() {
    if (state.nativeEditingInstalled || typeof beltChanged !== "function" ||
        typeof beltMode !== "function" || typeof beltApply !== "function" || typeof samRun !== "function" ||
        typeof beltLoad !== "function") return;
    // A native SAM/edit operation replaces the manual polygon as the latest
    // edit. Never let Ctrl+B reuse an earlier red deletion region afterwards.
    const nativeChanged = beltChanged;
    beltChanged = function (...args) {
      if (!state.committingPolygon) discardManualPolygon();
      return nativeChanged.apply(this, args);
    };
    const nativeApply = beltApply;
    beltApply = function (subtract, ...args) {
      const patch = captureSamPatch(Boolean(subtract));
      const result = nativeApply.call(this, subtract, ...args);
      if (patch && patch.key === BT.key && patch.generation === S.gen) {
        state.lastPatch = patch;
        updatePolygonTools(`${subtract ? "Đã xóa" : "Đã thêm"} ${patch.pixelCount.toLocaleString()} px bằng SAM3. Ctrl+B chỉ áp dụng phần vừa sửa.`);
      }
      return result;
    };
    const nativeMode = beltMode;
    beltMode = function (...args) {
      discardManualPolygon();
      return nativeMode.apply(this, args);
    };
    const nativeSam = samRun;
    samRun = function (...args) {
      cancelManualMode();
      return nativeSam.apply(this, args);
    };
    const nativeLoad = beltLoad;
    beltLoad = function (...args) {
      const key = BT.key;
      const regionContext = prepareBeltRegionContext();
      if (regionContext) rememberBeltRegion();
      const result = nativeLoad.apply(this, args);
      if (result && regionContext && BT.key === regionContext.key) {
        const entering = !state.regionFrame || state.regionFrame.key !== BT.key;
        if (entering || !validBeltRegion(BT.region)) {
          const saved = state.frameRegions.get(BT.key) || state.clipRegions.get(regionContext.clip);
          if (validBeltRegion(saved)) BT.region = saved.slice();
        }
        state.regionFrame = regionContext;
        rememberBeltRegion();
      }
      if (BT.key !== key) discardManualPolygon();
      return result;
    };
    if (typeof beltPanel === "function") {
      const nativePanel = beltPanel;
      beltPanel = function (...args) {
        const result = nativePanel.apply(this, args);
        if (pageLabelingReady("seatbelt")) {
          const status = document.getElementById("btStat");
          if (BT.prev && status?.textContent.includes("Enter add")) {
            status.textContent = status.textContent.replace("Enter add", "R thêm");
          }
          const add = document.getElementById("btAdd");
          if (add?.textContent.includes("(Enter)")) {
            add.textContent = add.textContent.replace("(Enter)", "(R)");
          }
        }
        return result;
      };
    }
    state.nativeEditingInstalled = true;
  }

  function prepareBeltRegionContext() {
    if (!pageLabelingReady("seatbelt")) return null;
    const previous = state.regionScope;
    if (!previous || previous.generation !== S.gen || previous.session !== S.sess ||
        previous.width !== S.sess.src_w || previous.height !== S.sess.src_h) {
      state.regionScope = { generation: S.gen, session: S.sess,
        width: S.sess.src_w, height: S.sess.src_h };
      state.frameRegions.clear();
      state.clipRegions.clear();
      state.regionFrame = null;
      if (previous) {
        // A new session can reuse segment/frame keys. Reload its mask and ROI
        // instead of retaining an editor buffer from the previous session.
        BT.key = null;
        BT.region = null;
        discardManualPolygon();
      }
    }
    const li = state.list?.querySelector(`li[data-g="${S.shownG}"]`);
    const row = li?.closest(".grp");
    const part = row?.dataset.partName || row?.querySelector(":scope > .vlab")?.textContent?.trim();
    const clip = li?.closest(".nl-clip")?.dataset.key || (part ? clipKey(part, getClipNo(li)) : null);
    return { key: rvKey(S.shownG), clip };
  }

  function validBeltRegion(region) {
    return Array.isArray(region) && region.length === 4 && region.every(Number.isFinite) &&
      region[0] >= 0 && region[1] >= 0 && region[2] <= BT.W && region[3] <= BT.H &&
      region[2] > region[0] && region[3] > region[1];
  }

  function rememberBeltRegion() {
    const frame = state.regionFrame;
    if (!frame || frame.key !== BT.key || !validBeltRegion(BT.region)) return;
    // ROI is a local SAM crop, separate from the mask copied by Ctrl+B.
    // Remember each frame's crop and inherit it only within the same clip.
    state.frameRegions.set(frame.key, BT.region.slice());
    if (frame.clip) state.clipRegions.set(frame.clip, BT.region.slice());
  }

  function captureSamPatch(subtract) {
    if (!pageLabelingReady("seatbelt") || !BT.prev || !BT.mask || BT.key !== rvKey(S.shownG)) return null;
    const mask = new Uint8Array(BT.mask.length);
    let pixelCount = 0;
    for (let index = 0; index < mask.length; index += 1) {
      // A SAM prediction can overlap the pre-existing belt. Keep only pixels
      // changed by this Apply, so bulk copy cannot carry old segments along.
      if (BT.prev[index] && BT.mask[index] === (subtract ? 1 : 0)) {
        mask[index] = 1;
        pixelCount += 1;
      }
    }
    return { key: BT.key, generation: S.gen, kind: "sam", mask, pixelCount,
      operation: subtract ? "subtract" : "add" };
  }

  function ensurePolygonDrawing() {
    if (state.polygonDrawingInstalled || typeof beltDraw !== "function") return;
    const nativeDraw = beltDraw;
    beltDraw = function (...args) {
      // K controls the page's Auto-label visibility. On an editable seatbelt
      // frame the native editor draws its blue mask independently, so it used
      // to remain visible until the frame was Done. Honor the same switch
      // while the frame is In progress, including ROI, SAM preview and drafts.
      if (pageLabelingReady("seatbelt") && typeof S !== "undefined" && S.showAl === false) return;
      // Suppress the native white selection polygon while our colored editing
      // polygon is active. Keep the page's mask, ROI and other tools intact.
      const manual = state.manualMode && pageLabelingReady("seatbelt") &&
        typeof BT !== "undefined" && BT.key === rvKey(S.shownG);
      const key = manual ? BT.key : null;
      const points = manual ? BT.poly : null;
      const completed = manual ? BT.polyDone : null;
      if (manual) { BT.poly = []; BT.polyDone = null; }
      let result;
      try {
        result = nativeDraw.apply(this, args);
      } finally {
        // beltLoad resets editing state when navigation changes the frame.
        if (manual && BT.key === key) { BT.poly = points; BT.polyDone = completed; }
      }
      drawManualPolygon();
      return result;
    };
    state.polygonDrawingInstalled = true;
  }

  function drawManualPolygon() {
    if (!state.manualMode || !pageLabelingReady("seatbelt") || typeof BT === "undefined" ||
        typeof ctx === "undefined" || !BT.W || BT.key !== rvKey(S.shownG)) return;
    const draft = BT.poly || [];
    const last = patchMatchesContext({ sourceKey: BT.key, generation: S.gen }) &&
      state.lastPatch.operation === state.manualMode ? state.lastPatch : null;
    const points = draft.length ? draft : last?.points;
    if (!points?.length) return;
    const canvas = document.getElementById("view");
    const scale = canvas.width / BT.W;
    const unit = typeof pxK === "function" ? pxK() : canvas.width / canvas.getBoundingClientRect().width;
    const subtract = state.manualMode === "subtract";
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = subtract ? "#ff4d5a" : "#39ff88";
    ctx.fillStyle = subtract ? "rgba(255,77,90,.22)" : "rgba(57,255,136,.16)";
    ctx.lineWidth = 2 * unit;
    ctx.beginPath();
    points.forEach(([x, y], index) => ctx[index ? "lineTo" : "moveTo"](x * scale, y * scale));
    if (points.length >= 3) ctx.closePath();
    if (points.length >= 3) ctx.fill();
    ctx.stroke();
    if (draft.length && typeof ED !== "undefined" && ED.mouse) {
      const [x, y] = points[points.length - 1];
      ctx.setLineDash([4 * unit, 4 * unit]);
      ctx.beginPath();
      ctx.moveTo(x * scale, y * scale);
      ctx.lineTo(ED.mouse[0], ED.mouse[1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const [x, y] of points) {
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, 3.5 * unit, 0, Math.PI * 2);
      ctx.fillStyle = subtract ? "#ff4d5a" : "#39ff88";
      ctx.fill();
    }
    ctx.restore();
  }

  function ensurePolygonTools() {
    const beltTools = document.getElementById("beltTools");
    if (!beltTools || document.getElementById("nl-polygon-tools")) return;
    const tools = document.createElement("div");
    tools.id = "nl-polygon-tools";
    tools.innerHTML = `
      <div class="nl-poly-buttons">
        <button type="button" data-poly="add">＋ Polygon (N)</button>
        <button type="button" data-poly="subtract">− Vùng xóa (M)</button>
      </div>
      <div class="nl-poly-help">Bấm các điểm trên ảnh; bấm lại điểm đầu hoặc chuột phải để khép vùng.</div>
    `;
    const modes = beltTools.querySelector(".btModes");
    if (modes) modes.after(tools);
    else beltTools.prepend(tools);
    for (const button of tools.querySelectorAll("[data-poly]")) {
      button.addEventListener("click", () => setManualMode(button.dataset.poly));
    }
    updatePolygonTools();
  }

  function updatePolygonTools(message = "") {
    const tools = document.getElementById("nl-polygon-tools");
    if (!tools) return;
    for (const button of tools.querySelectorAll("[data-poly]")) {
      button.classList.toggle("on", button.dataset.poly === state.manualMode);
    }
    const help = tools.querySelector(".nl-poly-help");
    if (message) help.textContent = message;
    else if (state.manualMode === "add") help.textContent = "Đang vẽ vùng thêm · click các điểm · click điểm đầu/chuột phải để tạo mask và thoát vẽ · Esc để hủy.";
    else if (state.manualMode === "subtract") help.textContent = "Vùng xóa màu đỏ · click điểm đầu/chuột phải để khép · Ctrl+B để xóa nhiều frame · Esc bỏ vùng chờ áp dụng · Z hoàn tác.";
    else help.textContent = "SAM3: trái (+), phải (−), R thêm vùng xanh · F: Done/In progress · Space: chạy/dừng video · N: polygon · M: xóa vùng đỏ · Z: hoàn tác.";
  }

  function discardManualPolygon() {
    state.manualMode = null;
    state.lastPatch = null;
    if (typeof BT !== "undefined") {
      BT.poly = [];
      BT.polyDone = null;
      BT.dirty = true;
    }
    updatePolygonTools();
  }

  function cancelManualMode() {
    discardManualPolygon();
    try {
      if (typeof edRepaint === "function") edRepaint();
    } catch (_) {}
  }

  function setManualMode(mode) {
    if (state.operationBusy) return;
    if (!manualPolygonAvailable()) {
      notify("Frame Done đang bị khóa. Hãy chuyển về In progress trước khi vẽ polygon");
      return;
    }
    if (state.manualMode === mode) {
      cancelManualMode();
      return;
    }
    state.lastPatch = null;
    try {
      BT.prev = null;
      BT.info = null;
      BT.points = [];
      BT.poly = [];
      BT.polyDone = null;
      BT.req += 1;
      BT.busy = false;
      if (BT.sel) BT.sel.fill(0);
      BT.dirty = true;
    } catch (_) {}
    state.manualMode = mode;
    ensurePolygonDrawing();
    updatePolygonTools();
    if (typeof edRepaint === "function") edRepaint();
    notify(mode === "add" ? "Polygon thêm: chấm các điểm rồi click điểm đầu hoặc chuột phải" : "Polygon xóa: chấm các điểm rồi click điểm đầu hoặc chuột phải");
  }

  function pointOnView(event) {
    const canvas = document.getElementById("view");
    const rect = canvas.getBoundingClientRect();
    const width = typeof BT !== "undefined" && BT.W ? BT.W : canvas.width;
    const height = typeof BT !== "undefined" && BT.H ? BT.H : canvas.height;
    return [
      Math.max(0, Math.min(width - 1, (event.clientX - rect.left) * width / rect.width)),
      Math.max(0, Math.min(height - 1, (event.clientY - rect.top) * height / rect.height))
    ];
  }

  function manualPolygonStageTarget(event) {
    if (!state.manualMode) return false;
    const stage = document.getElementById("stage");
    return !!stage && event.target === stage;
  }

  function onManualMouseMove(event) {
    if (!manualPolygonStageTarget(event) || !manualPolygonAvailable() || typeof ED === "undefined") return;
    const canvas = document.getElementById("view");
    if (!canvas || !BT.W) return;
    const point = pointOnView(event);
    const scale = canvas.width / BT.W;
    ED.mouse = [point[0] * scale, point[1] * scale];
    if (typeof edRepaint === "function") edRepaint();
  }

  function polygonPatch(points, width, height) {
    const patch = new Uint8Array(width * height);
    const ys = points.map((point) => point[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y += 1) {
      const scanY = y + 0.5;
      const intersections = [];
      for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
        const [x1, y1p] = points[index];
        const [x2, y2p] = points[previous];
        if ((y1p > scanY) !== (y2p > scanY)) intersections.push(((x2 - x1) * (scanY - y1p)) / (y2p - y1p) + x1);
      }
      intersections.sort((a, b) => a - b);
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        const x0 = Math.max(0, Math.ceil(intersections[index]));
        const x1 = Math.min(width - 1, Math.floor(intersections[index + 1]));
        for (let x = x0; x <= x1; x += 1) patch[y * width + x] = 1;
      }
    }
    return patch;
  }

  function commitManualPolygon() {
    if (!manualPolygonAvailable() || !state.manualMode || BT.poly.length < 3) {
      notify("Polygon cần ít nhất 3 điểm");
      return;
    }
    const points = BT.poly.map((point) => point.slice());
    const patch = polygonPatch(points, BT.W, BT.H);
    const subtract = state.manualMode === "subtract";
    let changed = 0;
    for (let index = 0; index < patch.length; index += 1) {
      if (patch[index] && BT.mask[index] === (subtract ? 1 : 0)) changed += 1;
    }
    if (changed) {
      if (typeof pushUndo === "function") pushUndo();
      for (let index = 0; index < patch.length; index += 1) {
        if (patch[index]) BT.mask[index] = subtract ? 0 : 1;
      }
    }
    state.lastPatch = { key: BT.key, generation: S.gen, kind: "polygon", mask: patch, points,
      operation: subtract ? "subtract" : "add" };
    if (subtract) {
      try { if (typeof polyFlash === "function") polyFlash(BT, points); } catch (_) {}
    } else {
      // The add polygon is finished: show the saved blue mask immediately.
      // Keep lastPatch available for Ctrl+B, without retaining drawing handles.
      state.manualMode = null;
      BT.polyDone = null;
    }
    BT.poly = [];
    BT.dirty = true;
    if (changed && typeof beltChanged === "function") {
      state.committingPolygon = true;
      try { beltChanged(); } finally { state.committingPolygon = false; }
    }
    else if (typeof edRepaint === "function") edRepaint();
    updatePolygonTools(`${subtract ? "Đã xóa" : "Đã thêm"} polygon (${changed.toLocaleString()} px). Ctrl+B để áp dụng cho frame khác.` +
      (subtract ? " Esc để thoát vùng xóa." : " Nhấn N để vẽ tiếp."));
    notify(`${subtract ? "Đã xóa" : "Đã thêm"} polygon · ${changed.toLocaleString()} px`);
  }

  function onManualMouseDown(event) {
    if (!state.manualMode) return;
    const onView = event.target === document.getElementById("view");
    const onStage = manualPolygonStageTarget(event);
    if (!onView && !onStage) return;
    // N and M may place a point from the black area around the image. The
    // coordinate is clamped by pointOnView, so the saved point stays on-image.
    // Keep right-click closing limited to the image itself.
    if (onStage && event.button !== 0) return;
    if (!manualPolygonAvailable()) {
      cancelManualMode();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    try { if (typeof pause === "function") pause(); } catch (_) {}

    if (event.button === 2) {
      commitManualPolygon();
      return;
    }
    if (event.button !== 0) return;
    const point = pointOnView(event);
    if (BT.poly.length >= 3) {
      const first = BT.poly[0];
      const tolerance = 12 * BT.W / document.getElementById("view").getBoundingClientRect().width;
      if (Math.hypot(point[0] - first[0], point[1] - first[1]) <= tolerance) {
        commitManualPolygon();
        return;
      }
    }
    if (!BT.poly.length) {
      state.lastPatch = null;
      BT.polyDone = null;
    }
    BT.poly.push(point);
    if (typeof edRepaint === "function") edRepaint();
    updatePolygonTools(`Đã chấm ${BT.poly.length} điểm · click điểm đầu hoặc chuột phải để khép.`);
  }

  function samAcceptAvailable() {
    return !state.manualMode && pageLabelingReady("seatbelt") && typeof BT !== "undefined" &&
      !(typeof RV_OPEN !== "undefined" && RV_OPEN) && typeof beltActive === "function" && beltActive() &&
      (BT.mode === "pt" || BT.mode === "box");
  }

  function acceptSamPreview() {
    if (state.operationBusy || state.bulkDialog?.open || !manualPolygonAvailable()) return;
    if (BT.busy) {
      notify("SAM3 đang xử lý. Chờ vùng xanh lá rồi nhấn R để thêm");
      return;
    }
    if (!BT.prev) {
      notify("Chưa có vùng xanh lá SAM3 để thêm");
      return;
    }
    try { if (typeof pause === "function") pause(); } catch (_) {}
    beltApply(false);
    notify("Đã thêm mask SAM3 · Ctrl+B để chồng phần mới thêm");
  }

  function onViewContextMenu(event) {
    if (state.bboxMode === "delete" && bboxDeleteTarget(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      commitBboxDeletePolygon();
      return;
    }
    if (state.manualMode && event.target === document.getElementById("view")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function anyBulkDialogOpen() {
    return Boolean(state.bulkDialog?.open || state.eyeBulkDialog?.open);
  }

  function onGlobalKeyDown(event) {
    const target = event.target;
    const typing = target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || "");
    if (event.code === "KeyR" && !event.ctrlKey && !event.metaKey && !event.altKey && !typing) {
      const pendingSam = samAcceptAvailable() && (BT.prev || BT.busy || BT.points.length);
      if (anyBulkDialogOpen() || state.samAcceptHeld || pendingSam) {
        // R confirms SAM once; held-key repeats cannot create another edit.
        // F and Space remain entirely with the page's native handlers.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!anyBulkDialogOpen()) {
          state.samAcceptHeld = true;
          if (!event.repeat) acceptSamPreview();
        }
        return;
      }
    }
    // Handle Escape before the page's input listener blurs the count field.
    // Cancellation discards the region; a successful Apply keeps it reusable.
    if (event.code === "Escape" && anyBulkDialogOpen()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (state.eyeBulkDialog?.open) cancelEyeBulkDialog();
      else cancelBulkDialog();
      return;
    }
    if (event.code === "Escape" && state.bboxMode && !typing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelBboxMode();
      return;
    }
    if (event.code === "KeyZ" && !event.altKey && !event.shiftKey && !typing &&
        !anyBulkDialogOpen() && quickBboxReady()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) undoQuickBbox();
      return;
    }
    if (event.code === "KeyZ" && !event.altKey && !event.shiftKey && !typing &&
        !anyBulkDialogOpen() && pageLabelingReady("seatbelt")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) undoSeatbelt();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !typing &&
        !anyBulkDialogOpen() && quickBboxReady() && (event.code === "KeyC" || event.code === "KeyV")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) {
        if (event.code === "KeyC") copyQuickBboxToClipboard();
        else pasteQuickBboxFromClipboard();
      }
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !typing && !anyBulkDialogOpen() &&
        quickBboxReady() && event.code === "KeyX") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) deleteQuickBbox("all", event.shiftKey);
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !typing &&
        !anyBulkDialogOpen() && quickBboxReady() && (event.code === "Digit1" || event.code === "Numpad1" ||
          event.code === "Digit2" || event.code === "Numpad2")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) deleteQuickBbox(event.code.endsWith("1") ? "left" : "right");
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !typing && !anyBulkDialogOpen() &&
        quickBboxReady() && event.code === "KeyC") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) copyPreviousQuickBbox(event.shiftKey);
      return;
    }
    if (event.code === "Escape" && (state.manualMode || state.lastPatch) && !typing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelManualMode();
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !typing && !anyBulkDialogOpen() &&
        (event.code === "KeyA" || event.code === "KeyD") && pageLabelingReady()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigateOrganizedFrames(event.code === "KeyA" ? -1 : 1, event.shiftKey ? 10 : 1);
      return;
    }
    if (event.code === "KeyV" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey &&
        !typing && pageLabelingReady() && !anyBulkDialogOpen()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) toggleMarkedFrame();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === "KeyB" &&
        !typing && pageLabelingReady() &&
        (S.labelSel === "seatbelt" || S.labelSel === "eye_lmk" || GENERIC_COPY_LABELS.has(S.labelSel) ||
          (markedScopeMatches() && state.markedFrames.size))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) openBulkDialog();
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !typing &&
        !anyBulkDialogOpen() && (event.code === "KeyN" || event.code === "KeyM") && bboxLabelingReady()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) setBboxMode(event.code === "KeyN" ? "create" : "delete");
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey &&
        (event.code === "KeyN" || (event.code === "KeyM" && !event.shiftKey)) && !typing &&
        pageLabelingReady("seatbelt") && !anyBulkDialogOpen()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) setManualMode(event.code === "KeyM" || event.shiftKey ? "subtract" : "add");
    }
  }

  function onGlobalKeyUp(event) {
    if (event.code === "KeyR") state.samAcceptHeld = false;
  }

  function undoSeatbelt() {
    if (state.operationBusy || !manualPolygonAvailable()) return;
    if (state.manualMode && BT.poly.length) {
      BT.poly.pop();
      BT.dirty = true;
      if (typeof edRepaint === "function") edRepaint();
      updatePolygonTools(`Đã hoàn tác điểm cuối · còn ${BT.poly.length} điểm.`);
      return;
    }
    if (typeof beltUndo !== "function" || !BT.undo.length) {
      notify("Không còn thao tác để hoàn tác ở frame này");
      return;
    }
    // Do not keep propagating a polygon that the user has just undone.
    if (patchMatchesContext({ sourceKey: BT.key, generation: S.gen })) state.lastPatch = null;
    BT.polyDone = null;
    beltUndo();
    updatePolygonTools("Đã hoàn tác thao tác sửa mask ở frame hiện tại.");
  }

  function restoreNativeGroups() {
    if (!state.list) return;
    state.applying = true;
    try {
      for (const row of state.list.querySelectorAll(":scope > .grp.nl-organized")) {
        const clips = row.querySelector(":scope > .nl-clips");
        if (!clips) continue;
        const ul = document.createElement("ul");
        for (const li of clips.querySelectorAll("li")) {
          li.querySelectorAll(".nl-checkpoint").forEach((marker) => marker.remove());
          li.querySelectorAll(".nl-frame-mark").forEach((marker) => marker.remove());
          li.classList.remove("nl-marked-frame");
          ul.appendChild(li);
        }
        clips.replaceWith(ul);
        row.querySelector(":scope > .vlab .nl-part-total")?.remove();
        row.classList.remove("nl-organized");
        delete row.dataset.partName;
        row.hidden = false;
      }
    } finally {
      state.observer?.takeRecords();
      state.applying = false;
    }
  }

  function ensureCurrentClipOpen() {
    if (!state.list) return;
    for (const details of state.list.querySelectorAll(".nl-clip")) {
      const hasCurrent = Boolean(details.querySelector("li.cur"));
      details.classList.toggle("nl-current", hasCurrent);
      if (hasCurrent && !details.open && !state.manuallyClosedClips.has(details.dataset.key)) {
        details.open = true;
        state.openClips.add(details.dataset.key);
      }
    }
  }

  function applyFilter() {
    if (!state.list || !state.status) return;
    const query = normalize(state.filter);
    const rows = Array.from(state.list.querySelectorAll(":scope > .grp"));
    let visible = 0;

    for (const row of rows) {
      const partName = row.dataset.partName || row.querySelector(":scope > .vlab")?.textContent || "";
      const matched = !query || normalize(partName).includes(query);
      row.hidden = !matched;
      if (matched) visible += 1;
    }

    const caption = query ? `${visible}/${rows.length} part` : `${rows.length} part`;
    if (state.status.textContent !== caption) state.status.textContent = caption;

    if (!state.empty) {
      state.empty = document.createElement("div");
      state.empty.className = "nl-empty-filter";
      state.empty.textContent = "Không tìm thấy part phù hợp.";
    }
    const shouldShowEmpty = Boolean(query && rows.length && !visible);
    if (shouldShowEmpty && !state.empty.isConnected) state.list.prepend(state.empty);
    else if (!shouldShowEmpty && state.empty.isConnected) state.empty.remove();
  }

  function enhance() {
    state.scheduled = false;
    if (!state.list || !state.list.isConnected) return;

    if (!isLabelingMode()) {
      state.sidebarScope = null;
      if (state.toolbar) state.toolbar.hidden = true;
      if (state.markedBadge) state.markedBadge.hidden = true;
      if (state.manualMode || state.lastPatch) cancelManualMode();
      restoreNativeGroups();
      return;
    }

    state.toolbar.hidden = false;
    ensureSidebarRendering();
    ensureStatusRendering();
    ensureOrganizedPlayback();
    ensureNativeEditing();
    ensureLabelVisibility();
    ensureEyeGroupDragging();
    ensureEyeTransformDrawing();
    ensureEyePanelHint();
    ensurePolygonDrawing();
    ensurePointerPerformance();
    ensureZoomPerformance();
    ensurePolygonTools();
    if (!pageLabelingReady("seatbelt") && (state.manualMode || state.lastPatch)) cancelManualMode();
    if (state.bboxMode && !bboxLabelingReady()) cancelBboxMode();
    state.applying = true;
    try {
      for (const row of state.list.querySelectorAll(":scope > .grp")) organizeGroup(row);
      for (const details of state.list.querySelectorAll(".nl-clip")) refreshClipStatusControls(details);
      ensureCurrentClipOpen();
      applyFilter();
      updateMarkedUI();
      trackQuickFrameHistory();
      state.sidebarScope = typeof S !== "undefined" ? { generation: S.gen, label: S.labelSel } : null;
    } finally {
      // MutationObserver callbacks run after this function returns. Clear the
      // records produced by our own grouping/status UI to prevent a RAF loop.
      state.observer?.takeRecords();
      state.applying = false;
    }
  }

  function scheduleEnhance() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(enhance);
  }

  function install() {
    state.pane = document.getElementById("labPane");
    state.list = document.getElementById("labList");
    if (!state.pane || !state.list || document.getElementById(ROOT_ID)) return false;

    injectStyle();
    state.toolbar = buildToolbar();
    state.list.before(state.toolbar);
    buildMarkedBadge();
    ensureSidebarRendering();
    ensureStatusRendering();
    ensureOrganizedPlayback();
    ensureNativeEditing();
    ensureLabelVisibility();
    ensureEyeGroupDragging();
    ensureEyeTransformDrawing();
    ensureEyePanelHint();
    ensurePolygonDrawing();
    ensurePointerPerformance();
    ensureZoomPerformance();
    ensurePolygonTools();
    ensureBulkDialog();
    ensureEyeBulkDialog();

    window.addEventListener("keydown", onGlobalKeyDown, true);
    window.addEventListener("keyup", onGlobalKeyUp, true);
    window.addEventListener("mouseup", onBboxMouseUp, true);
    window.addEventListener("blur", () => { state.samAcceptHeld = false; });
    window.addEventListener("resize", positionMarkedBadge);
    window.addEventListener("scroll", positionMarkedBadge, true);
    window.addEventListener("mousemove", onBboxMouseMove, true);
    window.addEventListener("mousemove", onManualMouseMove, true);
    window.addEventListener("mousedown", onBboxMouseDown, true);
    window.addEventListener("mousedown", onManualMouseDown, true);
    window.addEventListener("contextmenu", onViewContextMenu, true);
    window.addEventListener("dblclick", onBodyEdgeDoubleClick, true);

    state.observer = new MutationObserver((mutations) => {
      if (state.applying) return;
      const relevant = mutations.some((mutation) => {
        if (mutation.type === "childList") return true;
        return mutation.type === "attributes" && mutation.attributeName === "class";
      });
      if (relevant) scheduleEnhance();
    });
    state.observer.observe(state.list, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    const title = document.getElementById("labTitle");
    if (title) state.observer.observe(title, { childList: true, subtree: true, characterData: true });

    scheduleEnhance();
    console.info(`[NOTA Labeling Organizer] v${VERSION} đang hoạt động.`);
    return true;
  }

  if (!install()) {
    const bootObserver = new MutationObserver(() => {
      if (install()) bootObserver.disconnect();
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
