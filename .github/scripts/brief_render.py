#!/usr/bin/env python3
"""
Fisher Family Hub — Morning Brief renderer.

The ONE canonical layout. The scheduled task supplies data as JSON and runs
this script; it never re-authors the drawing code. Same input -> same sheet.

Usage:  python3 brief_render.py data.json out.pdf

data.json shape (every key optional except date_iso):
{
  "date_iso":  "2026-08-31",
  "summary":   "paragraph of prose",
  "weekend":   false,                      # omit to derive from date_iso
  "workout1":  "prose sentence(s)",        # weekday: Workout #1 / weekend: the optional workout
  "workout2":  "prose sentence(s)",        # weekday only
  "calendar":  [{"time": "11:15 AM", "title": "Guesty training"}],
  "priorities":["star item", "second", ...],   # weekday
  "fun":       ["Birthday party", ...],        # weekend
  "dinner":    "Sheet-pan chicken",
  "dinner_prep":"defrost at lunch"
}
Missing/empty sections render their header plus blank ruled lines.
"""
import json
import sys
from datetime import date, datetime

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

NAVY = HexColor("#003157")
RED = HexColor("#B22234")
INK = HexColor("#14273A")
MUTED = HexColor("#5F6B78")
HAIR = HexColor("#E2E5EA")
RULE = HexColor("#D9DEE4")
PANEL = HexColor("#F6F7F9")
STARBG = HexColor("#FBF1F2")

W, H = letter
M = 0.45 * 72                      # margin
GUT = 0.30 * 72                    # gutter
COL = (W - 2 * M - GUT) / 2.0
LCOL = M
RCOL = M + COL + GUT

BOX = 12                           # checkbox side
LINE_GAP = 16                      # ruled note line spacing


def wrap(c, text, font, size, width):
    """Greedy wrap; always returns at least one line."""
    words = str(text).split()
    if not words:
        return [""]
    lines, cur = [], words[0]
    for w in words[1:]:
        trial = cur + " " + w
        if stringWidth(trial, font, size) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


class Sheet:
    def __init__(self, path):
        self.c = canvas.Canvas(path, pagesize=letter)
        self.c.setTitle("Morning Brief")

    # ---------- primitives ----------
    def checkbox(self, x, y, size=BOX):
        self.c.setStrokeColor(NAVY)
        self.c.setLineWidth(1.4)
        self.c.roundRect(x, y, size, size, 2.5, stroke=1, fill=0)

    def ruled(self, x, y, width, count):
        self.c.setStrokeColor(RULE)
        self.c.setLineWidth(0.8)
        for i in range(count):
            yy = y - i * LINE_GAP
            self.c.line(x, yy, x + width, yy)
        return y - count * LINE_GAP + 4

    def header(self, x, y, label):
        self.c.setFont("Helvetica-Bold", 9)
        self.c.setFillColor(RED)
        # letter-spaced caps
        cx = x
        for ch in label.upper():
            self.c.drawString(cx, y, ch)
            cx += stringWidth(ch, "Helvetica-Bold", 9) + 0.7
        self.c.setStrokeColor(HAIR)
        self.c.setLineWidth(0.9)
        self.c.line(x, y - 5, x + COL, y - 5)
        return y - 19

    def prose_with_box(self, x, y, text, width):
        """Checkbox at left, wrapped prose beside it."""
        self.checkbox(x, y - 2)
        tx = x + BOX + 8
        tw = width - BOX - 8
        self.c.setFont("Helvetica", 10.5)
        self.c.setFillColor(INK)
        for i, line in enumerate(wrap(self.c, text, "Helvetica", 10.5, tw)):
            self.c.drawString(tx, y + 1.5 - i * 13.5, line)
            last = y + 1.5 - i * 13.5
        return last - 12

    # ---------- page pieces ----------
    def title(self, y, date_obj):
        pretty = date_obj.strftime("%A, %B %-d, %Y") if hasattr(date_obj, "strftime") else str(date_obj)
        self.c.setFont("Times-Bold", 21)
        self.c.setFillColor(NAVY)
        self.c.drawString(M, y, f"Mike Fisher — {pretty}")
        self.c.setFont("Helvetica", 8.5)
        self.c.setFillColor(MUTED)
        self.c.drawRightString(W - M, y + 2, "Morning Brief")
        self.c.setStrokeColor(NAVY)
        self.c.setLineWidth(3)
        self.c.line(M, y - 8, W - M, y - 8)
        return y - 26

    def summary(self, y, text):
        if not text:
            return y
        width = W - 2 * M - 26
        lines = wrap(self.c, text, "Helvetica", 10.5, width)
        pad = 11
        box_h = len(lines) * 15.75 + pad * 1.6
        top = y
        self.c.setFillColor(PANEL)
        self.c.rect(M, top - box_h, W - 2 * M, box_h, stroke=0, fill=1)
        self.c.setFillColor(RED)
        self.c.rect(M, top - box_h, 4, box_h, stroke=0, fill=1)
        self.c.setFont("Helvetica", 10.5)
        self.c.setFillColor(INK)
        ty = top - pad - 9
        for line in lines:
            self.c.drawString(M + 15, ty, line)
            ty -= 15.75
        return top - box_h - 20

    def cal_rows(self, x, y, events, width):
        if not events:
            self.c.setFont("Helvetica-Oblique", 10)
            self.c.setFillColor(MUTED)
            self.c.drawString(x, y, "Nothing on the calendar today.")
            return y - 16
        for ev in events[:8]:
            self.checkbox(x, y - 2)
            self.c.setFont("Helvetica-Bold", 8.5)
            self.c.setFillColor(NAVY)
            self.c.drawString(x + BOX + 7, y + 1, str(ev.get("time", ""))[:9])
            tx = x + BOX + 7 + 46
            tw = width - (BOX + 7 + 46)
            self.c.setFont("Helvetica", 10)
            self.c.setFillColor(INK)
            hard = "HARD STOP" in str(ev.get("title", "")).upper()
            if hard:
                self.c.setFont("Helvetica-Bold", 10)
                self.c.setFillColor(RED)
            lines = wrap(self.c, ev.get("title", ""), "Helvetica", 10, tw)
            for i, line in enumerate(lines[:2]):
                self.c.drawString(tx, y + 1 - i * 12, line)
            y -= 12 * max(1, len(lines[:2])) + 5
        return y - 2

    def priority_rows(self, x, y, items, width):
        if not items:
            # star box + three numbered blanks
            self.c.setStrokeColor(RED)
            self.c.setFillColor(STARBG)
            self.c.setLineWidth(1)
            self.c.roundRect(x, y - 8, width, 24, 5, stroke=1, fill=1)
            self.c.setFont("Helvetica-Bold", 11)
            self.c.setFillColor(RED)
            self.c.drawString(x + 8, y + 2, "*")
            self.checkbox(x + 20, y)
            self.c.setStrokeColor(RULE)
            self.c.setLineWidth(0.8)
            self.c.line(x + 38, y + 1, x + width - 8, y + 1)
            y -= 30
            for n in (2, 3, 4):
                self.c.setFont("Helvetica-Bold", 9)
                self.c.setFillColor(MUTED)
                self.c.drawString(x + 2, y + 2, f"{n}.")
                self.checkbox(x + 18, y)
                self.c.setStrokeColor(RULE)
                self.c.line(x + 36, y + 1, x + width - 4, y + 1)
                y -= 20
            return y
        star = items[0]
        rest = items[1:8]
        tw = width - 46
        slines = wrap(self.c, star, "Helvetica-Bold", 10.5, tw)
        pad_top, pad_bot = 9, 9
        text_h = len(slines) * 13
        box_h = text_h + pad_top + pad_bot
        box_top = y + 13          # a little above the first baseline
        box_bottom = box_top - box_h
        self.c.setStrokeColor(RED)
        self.c.setFillColor(STARBG)
        self.c.setLineWidth(1)
        self.c.roundRect(x, box_bottom, width, box_h, 5, stroke=1, fill=1)
        self.c.setFont("Helvetica-Bold", 11)
        self.c.setFillColor(RED)
        self.c.drawString(x + 7, y + 1, "*")
        self.checkbox(x + 19, y - 1)
        self.c.setFont("Helvetica-Bold", 10.5)
        self.c.setFillColor(INK)
        for i, line in enumerate(slines):
            self.c.drawString(x + 40, y + 1 - i * 13, line)
        y = box_bottom - 15
        for n, item in enumerate(rest, start=2):
            lines = wrap(self.c, item, "Helvetica", 10.5, tw)
            self.c.setFont("Helvetica-Bold", 9)
            self.c.setFillColor(MUTED)
            self.c.drawString(x + 2, y + 2, f"{n}.")
            self.checkbox(x + 18, y)
            self.c.setFont("Helvetica", 10.5)
            self.c.setFillColor(INK)
            for i, line in enumerate(lines[:2]):
                self.c.drawString(x + 38, y + 2 - i * 13, line)
            y -= 13 * len(lines[:2]) + 7
        if len(items) > 8:
            self.c.setFont("Helvetica-Oblique", 9)
            self.c.setFillColor(MUTED)
            self.c.drawString(x + 38, y + 2, f"+{len(items) - 8} more on the hub")
            y -= 14
        return y

    def simple_rows(self, x, y, items, width, blanks=4):
        if not items:
            return self.ruled(x, y, width, blanks)
        for item in items[:8]:
            lines = wrap(self.c, item, "Helvetica", 10.5, width - 22)
            self.checkbox(x, y - 2)
            self.c.setFont("Helvetica", 10.5)
            self.c.setFillColor(INK)
            for i, line in enumerate(lines[:2]):
                self.c.drawString(x + 22, y + 1 - i * 13, line)
            y -= 13 * len(lines[:2]) + 7
        return y

    def dinner(self, x, y, text, prep, width):
        if not text:
            self.checkbox(x, y - 2)
            self.c.setStrokeColor(RULE)
            self.c.setLineWidth(0.8)
            self.c.line(x + 22, y - 1, x + width, y - 1)
            y -= 18
            self.c.setFont("Helvetica", 9.5)
            self.c.setFillColor(MUTED)
            self.c.drawString(x + 22, y, "Start at 4:30 — family's home 5:15")
            return y - 14
        self.checkbox(x, y - 2)
        self.c.setFont("Helvetica-Bold", 11)
        self.c.setFillColor(NAVY)
        lines = wrap(self.c, text, "Helvetica-Bold", 11, width - 22)
        for i, line in enumerate(lines[:2]):
            self.c.drawString(x + 22, y + 1 - i * 13.5, line)
        y -= 13.5 * len(lines[:2]) + 3
        tail = (prep + " — " if prep else "") + "family's home 5:15"
        self.c.setFont("Helvetica", 9.5)
        self.c.setFillColor(MUTED)
        for i, line in enumerate(wrap(self.c, tail, "Helvetica", 9.5, width - 22)[:2]):
            self.c.drawString(x + 22, y - i * 12, line)
        return y - 24

    def footer(self, left, right):
        y = M + 8
        self.c.setStrokeColor(HAIR)
        self.c.setLineWidth(0.9)
        self.c.line(M, y + 12, W - M, y + 12)
        self.c.setFont("Helvetica-Oblique", 8.5)
        self.c.setFillColor(MUTED)
        self.c.drawString(M, y, left)
        self.c.drawRightString(W - M, y, right)

    def save(self):
        self.c.showPage()
        self.c.save()


def render(data, out_path):
    d = data.get("date_iso")
    try:
        dobj = datetime.strptime(d, "%Y-%m-%d").date()
    except Exception:
        dobj = date.today()
    weekend = data.get("weekend")
    if weekend is None:
        weekend = dobj.weekday() >= 5

    s = Sheet(out_path)
    y = s.title(H - M - 12, dobj)
    y = s.summary(y, data.get("summary", ""))
    top = y

    cal = list(data.get("calendar") or [])
    if not weekend:
        if not any("HARD STOP" in str(e.get("title", "")).upper() for e in cal):
            cal.append({"time": "3:30 PM", "title": "HARD STOP — Workout #2"})

        def mins(e):
            t = str(e.get("time", "")).strip().upper().replace(".", "")
            if t.startswith("ALL"):
                return -1
            try:
                hm, ap = t.split(" ")[0], ("PM" if "PM" in t else "AM")
                h, m = (hm.split(":") + ["0"])[:2]
                h, m = int(h) % 12, int(m)
                return h * 60 + m + (720 if ap == "PM" else 0)
            except Exception:
                return 9999
        cal.sort(key=mins)

    # ---------- left column ----------
    ly = top
    ly = s.header(LCOL, ly, "Workout #1 · 5:00 AM" if not weekend else "Workout · Morning")
    w1 = (data.get("workout1") or "").strip()
    if w1:
        ly = s.prose_with_box(LCOL, ly, w1, COL)
        ly = s.ruled(LCOL, ly, COL, 3 if not weekend else 2)
    else:
        ly = s.ruled(LCOL, ly - 2, COL, 3)
    ly -= 12
    ly = s.header(LCOL, ly, "Calendar")
    ly = s.cal_rows(LCOL, ly, cal, COL)

    # ---------- right column ----------
    ry = top
    if not weekend:
        ry = s.header(RCOL, ry, "Priority List · 9:00–3:30")
        ry = s.priority_rows(RCOL, ry, [p for p in (data.get("priorities") or []) if str(p).strip()], COL)
        ry = s.ruled(RCOL, ry - 4, COL, 3)
        ry -= 14
        ry = s.header(RCOL, ry, "Workout #2 · 3:30 PM")
        w2 = (data.get("workout2") or "").strip()
        if w2:
            ry = s.prose_with_box(RCOL, ry, w2, COL)
            ry = s.ruled(RCOL, ry, COL, 2)
        else:
            ry = s.ruled(RCOL, ry - 2, COL, 3)
        ry -= 14
    else:
        ry = s.header(RCOL, ry, "Plans & Family Fun")
        ry = s.simple_rows(RCOL, ry, [f for f in (data.get("fun") or []) if str(f).strip()], COL, blanks=4)
        ry = s.ruled(RCOL, ry - 4, COL, 2)
        ry -= 14

    ry = s.header(RCOL, ry, "What's for Dinner? · 4:30 PM")
    s.dinner(RCOL, ry, (data.get("dinner") or "").strip(), (data.get("dinner_prep") or "").strip(), COL)

    s.footer(
        "The weekend is the plan." if weekend else "Shutdown at 4:00 — the evening is yours.",
        "Annie 6:30 · Sebastian 8:30 · Lights out 9:30",
    )
    s.save()
    return out_path


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "data.json"
    out = sys.argv[2] if len(sys.argv) > 2 else "morning_brief.pdf"
    with open(src) as fh:
        render(json.load(fh), out)
    print(f"wrote {out}")
