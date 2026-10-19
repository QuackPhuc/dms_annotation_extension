"""Selected bbox copy regressions. Run: uv run --with playwright python tests/test_bbox_copy.py"""
import copy
from pathlib import Path

from playwright.sync_api import sync_playwright


def box(*coords, cls=None):
    return {"box": list(coords), **({"cls": cls} if cls else {})}


outer = box(0.5, 0.5, 19.5, 19.5)
selected = box(3, 4, 14, 12)
third = box(4, 5, 6, 7)
target_outer = box(0.6, 0.4, 19.6, 19.4)
narrow = box(3, 6, 6.3, 12)
duplicate = box(3.1, 6.1, 6.4, 12.1)
target_third = box(4.1, 5.1, 6.1, 7.1)

cases = [
    ("narrow inner box and duplicates, enclosing box and third person preserved",
     [outer, selected, third], selected,
     [target_outer, narrow, target_third, duplicate],
     [target_outer, selected, target_third]),
    ("different source and target ordering",
     [third, selected, outer], selected,
     [target_third, narrow, duplicate, target_outer],
     [target_third, selected, target_outer]),
    ("small person inside a large body remains separate",
     [outer, third], third, [target_outer, target_third], [target_outer, third]),
    ("enclosing body remains separate even without a counterpart at source",
     [third], third, [target_outer, target_third], [target_outer, third]),
    ("large height correction collapses older duplicates",
     [box(2, 2, 6, 8), box(12, 3, 17, 9)], box(2, 2, 6, 8),
     [box(0, 0, 20, 20), box(2, 0, 6, 14), box(2.1, 2.1, 6.1, 8.1), box(12, 3, 17, 9)],
     [box(0, 0, 20, 20), box(2, 2, 6, 8), box(12, 3, 17, 9)]),
    ("no matching target appends one box",
     [selected], selected, [box(16, 16, 19, 19)], [box(16, 16, 19, 19), selected]),
    ("partial intersection alone does not replace",
     [box(2, 2, 6, 8)], box(2, 2, 6, 8),
     [box(3, 3, 7, 9)], [box(3, 3, 7, 9), box(2, 2, 6, 8)]),
    ("a closer unselected source protects an overlapping annotation",
     [box(2, 2, 10, 10), box(4, 2, 12, 10)], box(2, 2, 10, 10),
     [box(4, 2, 12, 10)], [box(4, 2, 12, 10), box(2, 2, 10, 10)]),
    ("same position with different object classes",
     [box(2, 2, 8, 8, cls="can")], box(2, 2, 8, 8, cls="can"),
     [box(2, 2, 8, 8, cls="bottle")],
     [box(2, 2, 8, 8, cls="bottle"), box(2, 2, 8, 8, cls="can")]),
    ("source duplicates do not shield target duplicates",
     [selected, copy.deepcopy(selected)], selected, [selected, copy.deepcopy(selected)], [selected]),
]


def transpose(item):
    x1, y1, x2, y2 = item["box"]
    return {**item, "box": [y1, x1, y2, x2]}


def main():
    content = (Path(__file__).resolve().parents[1] / "extension" / "content.js").read_text(encoding="utf-8")
    guard = '  if (!ALLOWED_ORIGINS.has(location.origin) || document.getElementById(ROOT_ID)) return;'
    assert content.count(guard) == 1
    # Expose the actual production function on about:blank. The origin guard
    # then exits normally, without installing any application UI or listeners.
    content = content.replace(guard, '  window.copyBboxForTest = mergeCopiedGenericBbox;\n' + guard)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.add_script_tag(content=content)
        for transpose_axes in (False, True):
            transform = transpose if transpose_axes else copy.deepcopy
            for name, sources, copied, targets, expected in cases:
                payload = {"sources": [transform(x) for x in sources], "copied": transform(copied),
                           "targets": [transform(x) for x in targets]}
                result = page.evaluate("""data => {
                  const before = JSON.stringify(data);
                  const first = copyBboxForTest(data.targets, data.copied, data.sources);
                  const again = copyBboxForTest(first, data.copied, data.sources);
                  return {first, again, unchanged: JSON.stringify(data) === before};
                }""", payload)
                wanted = [transform(x) for x in expected]
                assert result["first"] == wanted, (name, transpose_axes, result)
                assert result["again"] == wanted, (name, "repeated copy", result)
                assert result["unchanged"], (name, "mutated input")
        browser.close()
    print(f"PASS: {len(cases) * 2} bbox-copy cases, repeated paste and input preservation")


if __name__ == "__main__":
    main()
