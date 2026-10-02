"""
Natural-language what-if -> validated Decision Twin parameters.

"What happens if we add two sales reps?" becomes ScenarioParams(sales_reps_count=6) run through the
same deterministic Twin as the sliders. Everything here is regex + arithmetic:

  * The LLM planner may classify a question as a scenario, but it never supplies a number. Every
    value is read from the question text by this module.
  * Relative wording ("add 2 reps", "increase outreach by 25%", "double the team") is applied to the
    stated BASELINE and the arithmetic is shown; hours become whole days ("48 hours = 2 days").
  * Nothing is clamped or guessed. A value outside the Twin's own bounds, or two conflicting values
    for one lever, is a `problem` and then NO simulation is run.
  * Wording that is ambiguous (a bare "2 reps", "increase outreach" with no amount) or asks for
    something the Twin does not model (a MAXIMUM deal size) is reported in `unsupported`; the levers
    that ARE clear are still simulated and the answer says exactly which ones were applied. If no
    lever is clear, that report becomes the (blocking) problem.
  * Amounts are read in the workspace currency (USD). A different currency symbol is not converted;
    a note says so.

The bounds are read from `ScenarioParams` itself, so they cannot drift from what the Twin accepts.
"""
import math
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.decision_forge.schemas import ScenarioParams

WORD_NUMBERS: Dict[str, int] = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30,
    "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}
MAGNITUDES = {"k": 1e3, "thousand": 1e3, "m": 1e6, "mn": 1e6, "mm": 1e6, "million": 1e6,
              "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5, "crore": 1e7, "crores": 1e7, "cr": 1e7}

_WORDS = "|".join(sorted(WORD_NUMBERS, key=len, reverse=True))
_NUM = rf"(?:\d[\d,]*(?:\.\d+)?|{_WORDS})"
_COUNT = rf"(?:{_NUM}|an?)"                       # "a rep", "an additional rep"
_REP = (r"(?:sales\s*)?(?:reps?|representatives?|salespeople|sales\s+people|salespersons?|sdrs?|bdrs?|"
        r"account\s+executives?|aes?|sellers?)")
_CONTACT = (r"(?:(?:outbound|cold|sales|customer|client|prospect)\s+)?"
            r"(?:contacts?|calls?|touch(?:es|points?)?|outreach(?:es)?|emails?|meetings?|conversations?|activities)")
_OUTREACH = r"(?P<noun>outreach|capacity|contacts?|calls?|touch(?:es|points?)?|activity|volume|outbound)"
_UP = r"(?:increase|raise|boost|grow|expand|lift|step\s+up|ramp\s+up|scale\s+up|bump\s+up|bump)"
_DOWN = r"(?:decrease|reduce|cut|lower|drop|trim|scale\s+down)"
_DIR_UP = ("more", "higher", "greater", "extra", "up")

_MONEY = (r"(?P<cur>[$₹€£]|rs\.?|inr|usd|eur|gbp)?\s*(?P<num>\d[\d,]*(?:\.\d+)?)\s*"
          r"(?P<mag>thousand|million|lakhs?|lacs?|crores?|mn|mm|cr|k|m)?"
          r"(?:\s*(?P<cur2>usd|dollars?|inr|rupees?|eur|euros?|gbp|pounds?))?(?![a-z])")

_CURRENCY_NAMES = {"$": "USD", "usd": "USD", "dollar": "USD", "dollars": "USD", "₹": "INR", "rs": "INR", "rs.": "INR",
                   "inr": "INR", "rupee": "INR", "rupees": "INR", "€": "EUR", "eur": "EUR", "euro": "EUR", "euros": "EUR",
                   "£": "GBP", "gbp": "GBP", "pound": "GBP", "pounds": "GBP"}

INT_LEVERS = ("sales_reps_count", "contacts_per_day", "followup_window_days")
LEVER_LABELS = {
    "sales_reps_count": "sales reps",
    "contacts_per_day": "contacts per rep per day",
    "min_deal_value": "minimum deal value",
    "followup_window_days": "follow-up window (days)",
    "priority_threshold": "priority cutoff",
}
SUPPORTED_LEVERS_HELP = (
    "I can simulate: the number of sales reps (e.g. 'add two reps', 'only have 3 reps'), outreach volume ('30 contacts "
    "per rep per day', 'increase outreach by 25%', 'double the outreach'), a minimum deal value ('only pursue deals above "
    "$500,000'), the follow-up window ('follow up within 48 hours') and the priority cutoff ('priority cutoff of 70')."
)


def _bounds(name: str) -> Tuple[Optional[float], Optional[float]]:
    lo = hi = None
    for meta in ScenarioParams.model_fields[name].metadata:
        lo = getattr(meta, "ge", lo)
        hi = getattr(meta, "le", hi)
    return lo, hi


def _to_number(token: str) -> float:
    t = token.strip().lower().replace(",", "")
    if t in WORD_NUMBERS:
        return float(WORD_NUMBERS[t])
    if t in ("a", "an"):
        return 1.0
    return float(t)


def _round_half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


def _g(x: float) -> str:
    return f"{x:,.0f}" if float(x).is_integer() else f"{x:,.2f}".rstrip("0").rstrip(".")


@dataclass
class Lever:
    lever: str            # ScenarioParams field name
    mode: str             # add | remove | set | percent_up | percent_down | multiply
    requested: float      # the number written in the question (2, 48, 25, 500000, ...)
    unit: str             # reps | contacts/day | USD | hours | days | weeks | % | x | score
    baseline: float
    scenario: float
    note: str = ""        # how the wording was interpreted ("48 hours = 2 days")

    @property
    def label(self) -> str:
        return LEVER_LABELS[self.lever]

    def describe(self) -> str:
        if self.lever == "sales_reps_count":
            return f"{_g(self.scenario)} sales reps (baseline {_g(self.baseline)})"
        if self.lever == "contacts_per_day":
            return f"{_g(self.scenario)} contacts per rep per day (baseline {_g(self.baseline)})"
        if self.lever == "min_deal_value":
            return f"minimum deal value ${_g(self.scenario)} (baseline ${_g(self.baseline)})"
        if self.lever == "followup_window_days":
            return f"follow-up within {_g(self.scenario)} day{'s' if self.scenario != 1 else ''} (baseline {_g(self.baseline)})"
        return f"priority cutoff {_g(self.scenario)} (baseline {_g(self.baseline)})"

    def to_dict(self) -> Dict[str, Any]:
        return {"lever": self.lever, "label": self.label, "mode": self.mode, "requested": self.requested,
                "unit": self.unit, "baseline": self.baseline, "scenario": self.scenario, "note": self.note}


@dataclass
class ScenarioRequest:
    baseline: ScenarioParams
    levers: List[Lever] = field(default_factory=list)
    problems: List[str] = field(default_factory=list)        # blocking: nothing is simulated
    problem_details: List[Dict[str, Any]] = field(default_factory=list)   # the numbers behind each problem
    unsupported: List[str] = field(default_factory=list)     # non-blocking: not simulated, and why
    notes: List[str] = field(default_factory=list)           # non-blocking: how something was read

    @property
    def runnable(self) -> bool:
        return bool(self.levers) and not self.problems

    def scenario_params(self) -> ScenarioParams:
        values = self.baseline.model_dump()
        values.update({lv.lever: (int(lv.scenario) if lv.lever in INT_LEVERS else float(lv.scenario)) for lv in self.levers})
        return ScenarioParams(**values)

    def to_dict(self) -> Dict[str, Any]:
        return {"levers": [lv.to_dict() for lv in self.levers], "problems": list(self.problems),
                "problem_details": list(self.problem_details), "unsupported": list(self.unsupported), "notes": list(self.notes)}


def describe_params(p: ScenarioParams) -> str:
    return (f"{p.sales_reps_count} reps, {p.contacts_per_day} contacts per rep per day, minimum deal ${p.min_deal_value:,.0f}, "
            f"follow-up within {p.followup_window_days} days, priority cutoff {p.priority_threshold:g}")


class _Collector:
    """Collects candidate values per lever so two different readings of one lever are flagged as a conflict."""

    def __init__(self, baseline: ScenarioParams):
        self.baseline = baseline
        self.found: Dict[str, List[Lever]] = {}
        self.problems: List[str] = []
        self.details: List[Dict[str, Any]] = []
        self.soft: List[str] = []          # ambiguous wording: blocking only when no lever is clear
        self.unsupported: List[str] = []
        self.notes: List[str] = []

    def base(self, lever: str) -> float:
        return float(getattr(self.baseline, lever))

    def add(self, lever: str, mode: str, requested: float, unit: str, scenario: float, note: str = "") -> None:
        """Validates against the Twin's own bounds; an invalid value becomes a problem, never a clamp."""
        value = float(_round_half_up(scenario)) if lever in INT_LEVERS else float(scenario)
        if lever in INT_LEVERS and abs(value - scenario) > 1e-9:
            note = (note + "; " if note else "") + f"rounded {scenario:g} to {value:g} (whole numbers only)"
        lo, hi = _bounds(lever)
        if (lo is not None and value < lo) or (hi is not None and value > hi):
            span = f"{_g(lo)}-{_g(hi)}" if hi is not None else f"at least {_g(lo)}"
            self.problems.append(f"{LEVER_LABELS[lever].capitalize()} would be {_g(value)}, outside the supported range ({span}).")
            self.details.append({"kind": "out_of_range", "lever": lever, "requested": requested, "baseline": self.base(lever),
                                 "would_be": value, "min": lo, "max": hi})
            return
        self.found.setdefault(lever, []).append(Lever(lever, mode, requested, unit, self.base(lever), value, note))

    def result(self) -> ScenarioRequest:
        levers: List[Lever] = []
        for lever, candidates in self.found.items():
            distinct = {c.scenario for c in candidates}
            if len(distinct) > 1:
                shown = ", ".join(_g(v) for v in sorted(distinct))
                self.problems.append(f"The question gives conflicting values for {LEVER_LABELS[lever]} ({shown}); say which one you mean.")
                self.details.append({"kind": "conflict", "lever": lever, "values": sorted(distinct)})
            else:
                levers.append(candidates[0])
        order = list(LEVER_LABELS)
        levers.sort(key=lambda lv: order.index(lv.lever))
        problems, unsupported = list(self.problems), list(self.unsupported)
        if levers or problems:
            unsupported += self.soft            # something is clear enough to simulate: disclose, do not block
        else:
            problems += self.soft               # nothing clear: this is why there is nothing to run
        return ScenarioRequest(self.baseline, levers, problems, self.details, unsupported, self.notes)


def _money_value(m: "re.Match[str]") -> Tuple[float, Optional[str], bool]:
    """(amount in units, currency code or None, whether it is unmistakably money)."""
    value = _to_number(m.group("num"))
    mag = (m.group("mag") or "").lower()
    if mag:
        value *= MAGNITUDES[mag]
    cur_raw = (m.group("cur") or m.group("cur2") or "").lower()
    currency = _CURRENCY_NAMES.get(cur_raw) if cur_raw else None
    return value, currency, bool(cur_raw or mag)


def _written_amount(m: "re.Match[str]") -> str:
    """The amount as the user typed it (symbol, digits, magnitude), for the currency note."""
    return ((m.group("cur") or "") + m.group("num") + (m.group("mag") or "")
            + ((" " + m.group("cur2")) if m.group("cur2") else "")).strip()


def _currency_note(c: _Collector, currency: Optional[str], written: str, value: float) -> None:
    if currency and currency != "USD":
        c.notes.append(f"You wrote {written} ({currency}); this workspace's amounts are in USD, so it was applied as "
                       f"${_g(value)} with no currency conversion.")


# ---- reps ---------------------------------------------------------------------------------------
# Relative: an explicit add/remove verb. NOTE "have/had/with 2 reps" is deliberately NOT here: that states a
# team size ("only have 2 reps"); "have 2 MORE reps" is caught by _REP_ADD_MORE.
_REP_ADD = re.compile(
    rf"\b(?:add(?:ing)?|hir(?:e|ing)|onboard(?:ing)?|recruit(?:ing)?|bring(?:ing)?\s+on|get(?:ting)?)\s+"
    rf"(?P<n>{_COUNT})\s+(?:(?:more|additional|extra|new|other)\s+)?{_REP}\b")
_REP_ADD_MORE = re.compile(rf"\b(?P<n>{_NUM})\s+(?:more|additional|extra|new)\s+{_REP}\b")
_REP_REMOVE = re.compile(
    rf"\b(?:los(?:e|ing|t)|remov(?:e|ing)|cut(?:ting)?|drop(?:ping)?|let(?:ting)?\s+go|lay(?:ing)?\s+off|laid\s+off|reduc(?:e|ing)\s+by)\s+"
    rf"(?:of\s+)?(?P<n>{_COUNT})\s+(?:of\s+(?:our|the)\s+)?{_REP}\b")
_REP_FEWER = re.compile(rf"\b(?P<n>{_NUM})\s+(?:fewer|less)\s+{_REP}\b")
# Absolute: a stated team size.
_REP_SET = re.compile(
    rf"\b(?:only|just|with|have|has|had|having|use|using|run(?:ning)?|team\s+of|down\s+to|up\s+to|(?:reduce|cut|increase|grow|scale)\s+to|to)\s+"
    rf"(?:only\s+|just\s+)?(?P<n>{_NUM})\s+{_REP}\b")
_REP_SET_TRAIL = re.compile(rf"\b(?P<n>{_NUM})\s+{_REP}\s+(?:only|in\s+total|total)\b")
_REP_SCALE = re.compile(r"\b(?P<w>double|triple|halve)\s+(?:the\s+|our\s+)?(?:sales\s+)?(?:team|reps?|headcount|sales\s*force)\b")
_REP_MENTION = re.compile(rf"\b(?P<n>\d[\d,]*|{_WORDS})\s+{_REP}\b")
_SCALE_FACTORS = {"double": 2.0, "triple": 3.0, "halve": 0.5}


def _extract_reps(q: str, c: _Collector) -> None:
    base = c.base("sales_reps_count")
    matched = False
    for rx in (_REP_ADD, _REP_ADD_MORE):
        for m in rx.finditer(q):
            n = _to_number(m.group("n"))
            c.add("sales_reps_count", "add", n, "reps", base + n, f"{_g(base)} baseline + {_g(n)}")
            matched = True
    for rx in (_REP_REMOVE, _REP_FEWER):
        for m in rx.finditer(q):
            n = _to_number(m.group("n"))
            c.add("sales_reps_count", "remove", n, "reps", base - n, f"{_g(base)} baseline - {_g(n)}")
            matched = True
    for m in _REP_SCALE.finditer(q):
        f = _SCALE_FACTORS[m.group("w")]
        c.add("sales_reps_count", "multiply", f, "x", base * f, f"{_g(base)} baseline x {f:g}")
        matched = True
    for rx in (_REP_SET, _REP_SET_TRAIL):
        for m in rx.finditer(q):
            n = _to_number(m.group("n"))
            c.add("sales_reps_count", "set", n, "reps", n, "team size stated directly")
            matched = True
    if not matched:
        m = _REP_MENTION.search(q)
        if m:
            n = m.group("n")
            c.soft.append(f"'{m.group(0)}' is ambiguous: it could mean adding {n}, removing {n} or a total team of {n}. "
                          f"Try 'add {n} reps' or 'only have {n} reps'.")


# ---- outreach ------------------------------------------------------------------------------------
_CONTACTS_ABS = re.compile(rf"\b(?P<n>\d[\d,]*|{_WORDS})\s+{_CONTACT}\b(?P<tail>[^.?!;]{{0,32}})")
_OUTREACH_PCT = re.compile(
    rf"\b(?P<verb>{_UP}|{_DOWN})\s+(?:our\s+|the\s+|team\s+|sales\s+|each\s+rep'?s\s+)*{_OUTREACH}(?:\s+(?:capacity|volume|per\s+day))*"
    rf"\s+(?:by\s+)?(?P<n>\d[\d,]*(?:\.\d+)?)\s*(?:%|percent)")
_OUTREACH_PCT_TRAIL = re.compile(
    rf"\b(?P<n>\d[\d,]*(?:\.\d+)?)\s*(?:%|percent)\s+(?P<dir>more|higher|greater|extra|fewer|less|lower)\s+{_OUTREACH}\b")
_OUTREACH_PCT_AFTER = re.compile(
    rf"\b{_OUTREACH}\s+(?:was\s+|were\s+|is\s+|are\s+|be\s+|goes?\s+|going\s+|to\s+be\s+)?(?:by\s+)?"
    rf"(?:(?P<updown>up|down)\s+(?:by\s+)?)?(?P<n>\d[\d,]*(?:\.\d+)?)\s*(?:%|percent)(?:\s+(?P<dir>more|higher|greater|extra|fewer|less|lower))?")
_OUTREACH_MULT = re.compile(
    rf"\b(?P<w>double|triple|quadruple|halve)\s+(?:our\s+|the\s+)?(?:daily\s+)?{_OUTREACH}\b|"
    rf"\b(?P<t>twice)\s+(?:the|our)\s+(?:daily\s+)?(?P<noun2>outreach|capacity|contacts?|calls?|touch(?:es|points?)?|activity|volume|outbound)\b")
_OUTREACH_VAGUE = re.compile(rf"\b(?:{_UP}|{_DOWN})\s+(?:our\s+|the\s+)?(?:daily\s+)?{_OUTREACH}(?:\s+(?:capacity|volume))?\b")
_MULT_FACTORS = {"double": 2.0, "triple": 3.0, "quadruple": 4.0, "halve": 0.5}


def _capacity_note(noun: Optional[str]) -> str:
    return " (capacity change applied to contacts per rep per day; capacity = reps x contacts/day)" if noun == "capacity" else ""


def _extract_contacts(q: str, c: _Collector) -> None:
    base = c.base("contacts_per_day")
    matched = False
    for m in _CONTACTS_ABS.finditer(q):
        if re.search(r"\bday\b|\bdaily\b", m.group("tail") or ""):
            n = _to_number(m.group("n"))
            c.add("contacts_per_day", "set", n, "contacts/day", n, "contacts per rep per day stated directly")
            matched = True
    for m in _OUTREACH_PCT.finditer(q):
        pct = _to_number(m.group("n"))
        up = re.match(_UP, m.group("verb")) is not None
        c.add("contacts_per_day", "percent_up" if up else "percent_down", pct, "%", base * (1 + pct / 100 if up else 1 - pct / 100),
              f"{_g(base)} baseline {'+' if up else '-'} {_g(pct)}%" + _capacity_note(m.group("noun")))
        matched = True
    for m in _OUTREACH_PCT_TRAIL.finditer(q):
        pct = _to_number(m.group("n"))
        up = m.group("dir") in _DIR_UP
        c.add("contacts_per_day", "percent_up" if up else "percent_down", pct, "%", base * (1 + pct / 100 if up else 1 - pct / 100),
              f"{_g(base)} baseline {'+' if up else '-'} {_g(pct)}%" + _capacity_note(m.group("noun")))
        matched = True
    for m in _OUTREACH_PCT_AFTER.finditer(q):
        direction = m.group("updown") or m.group("dir")
        if not direction:
            continue                                         # "outreach at 25%" states no direction
        pct = _to_number(m.group("n"))
        up = direction in _DIR_UP
        c.add("contacts_per_day", "percent_up" if up else "percent_down", pct, "%", base * (1 + pct / 100 if up else 1 - pct / 100),
              f"{_g(base)} baseline {'+' if up else '-'} {_g(pct)}%" + _capacity_note(m.group("noun")))
        matched = True
    for m in _OUTREACH_MULT.finditer(q):
        f = 2.0 if m.group("t") else _MULT_FACTORS[m.group("w")]
        c.add("contacts_per_day", "multiply", f, "x", base * f,
              f"{_g(base)} baseline x {f:g}" + _capacity_note(m.group("noun") or m.group("noun2")))
        matched = True
    if not matched and _OUTREACH_VAGUE.search(q):
        c.soft.append("No amount was given for the outreach change; say how much, as a percentage or as a number of "
                      "contacts per rep per day.")


# ---- minimum deal value -------------------------------------------------------------------------
_MIN_ABOVE = re.compile(
    rf"(?:\babove|\bover|\bgreater\s+than|\bmore\s+than|\bat\s+least|\bexceeding|\bbigger\s+than|\blarger\s+than|"
    rf"\bworth\s+(?:at\s+least|more\s+than|over)|>=|>)\s*{_MONEY}")
_MIN_EXPLICIT = re.compile(
    rf"\bmin(?:imum)?(?:\s+(?:deal|opportunity))?(?:\s+(?:value|size|amount))?\s*(?:of|to|at|=|:|is|be|becomes?|from\s+\S+\s+to)?\s*{_MONEY}")
_MIN_NONE = re.compile(r"\b(?:no|without|remove|removing|removed|eliminate|drop\s+the|zero)\s+(?:the\s+)?min(?:imum)?(?:\s+(?:deal|opportunity))?(?:\s+(?:value|size|amount|threshold))?\b")
_MAX_DEAL = re.compile(
    rf"(?:\bbelow|\bunder|\bless\s+than|\bsmaller\s+than|\bat\s+most|\bmax(?:imum)?(?:\s+deal)?(?:\s+(?:value|size))?(?:\s+of)?)\s*{_MONEY}")
_DEAL_CONTEXT = re.compile(r"deal|opportunit|account|pursu|chase|target|worth|pipeline|size|value")


def _extract_min_deal(q: str, c: _Collector) -> None:
    for m in _MIN_ABOVE.finditer(q):
        value, currency, is_money = _money_value(m)
        # A bare number counts as a deal size only in a deal context ("more than 3 reps" is not one).
        if not (is_money or (value >= 1000 and _DEAL_CONTEXT.search(q))):
            continue
        c.add("min_deal_value", "set", value, "USD", value, "minimum deal value stated directly")
        _currency_note(c, currency, _written_amount(m), value)
    for m in _MIN_EXPLICIT.finditer(q):
        value, currency, _ = _money_value(m)
        c.add("min_deal_value", "set", value, "USD", value, "minimum deal value stated directly")
        _currency_note(c, currency, _written_amount(m), value)
    if _MIN_NONE.search(q):
        c.add("min_deal_value", "set", 0.0, "USD", 0.0, "no minimum deal value")
    for m in _MAX_DEAL.finditer(q):
        value, _, is_money = _money_value(m)
        if is_money or (value >= 1000 and _DEAL_CONTEXT.search(q)):
            c.unsupported.append("The Twin models a MINIMUM deal value, not a maximum, so an upper limit on deal size cannot be simulated.")
            break


# ---- follow-up window ---------------------------------------------------------------------------
_CTX = r"(?:follow[- ]?ups?|follow\s+up|respon[ds]e?|repl(?:y|ies)|reach\s+out|get\s+back|contact\w*|touch\w*|turnaround|sla|outreach)"
_TIME = rf"(?P<n>{_NUM})\s*[- ]?\s*(?P<unit>hours?|hrs?|h|days?|d|weeks?|wks?)\b"
_LIMIT = r"(?:within|inside|under|in\s+under|no\s+later\s+than|less\s+than)"
_FOLLOW_A = re.compile(rf"\b{_CTX}\b[^.?!;]{{0,40}}?\b{_LIMIT}\s+{_TIME}")
_FOLLOW_A2 = re.compile(rf"\b(?:respon[ds]e?|repl(?:y|ies)|follow[- ]?ups?|follow\s+up)\s+in\s+{_TIME}")
_FOLLOW_B = re.compile(rf"\b{_TIME}\s+(?:follow[- ]?up|response|reply|turnaround|sla)\b")
_SAME_DAY = re.compile(rf"\b{_CTX}\b[^.?!;]{{0,30}}?\b(?:same[- ]day|next[- ]day|next\s+business\s+day)\b|\b(?:same[- ]day|next[- ]day)\s+{_CTX}\b")


def _extract_followup(q: str, c: _Collector) -> None:
    seen = False
    for rx in (_FOLLOW_A, _FOLLOW_A2, _FOLLOW_B):
        for m in rx.finditer(q):
            n = _to_number(m.group("n"))
            unit = m.group("unit")
            if n <= 0:
                c.problems.append("The follow-up window must be at least one day.")
                c.details.append({"kind": "out_of_range", "lever": "followup_window_days", "requested": n, "would_be": n, "min": 1, "max": 30})
                seen = True
                continue
            if unit.startswith("h"):
                days, unit_name = max(1, math.ceil(n / 24)), "hours"
                exact = n >= 24 and n % 24 == 0
                note = f"{_g(n)} hours = {days} day{'s' if days != 1 else ''}" + ("" if exact else " (the model works in whole days, minimum 1)")
            elif unit.startswith("w"):
                days, unit_name, note = n * 7, "weeks", f"{_g(n)} weeks = {_g(n * 7)} days"
            else:
                days, unit_name, note = n, "days", ""
            c.add("followup_window_days", "set", n, unit_name, days, note)
            seen = True
    if not seen and _SAME_DAY.search(q):
        c.add("followup_window_days", "set", 1, "days", 1, "same/next day = 1 day")


# ---- priority cutoff ----------------------------------------------------------------------------
_CUTOFF = re.compile(
    r"\b(?:priority\s+|score\s+)?(?:cut-?off|threshold)\s*(?:of|to|at|=|:|is|was|were|be|becomes?|set\s+to|from\s+\S+\s+to)?\s*(?P<n>\d+(?:\.\d+)?)\b")
_SCORE_ABOVE = re.compile(r"\b(?:priority\s+)?score\s+(?:of\s+)?(?:above|over|at\s+least|>=|>)\s*(?P<n>\d+(?:\.\d+)?)\b")


def _extract_cutoff(q: str, c: _Collector) -> None:
    for rx in (_CUTOFF, _SCORE_ABOVE):
        for m in rx.finditer(q):
            n = float(m.group("n"))
            c.add("priority_threshold", "set", n, "score", n, "priority cutoff stated directly")


# ---- public API ---------------------------------------------------------------------------------
def parse_scenario(question: str, baseline: Optional[ScenarioParams] = None) -> ScenarioRequest:
    """Reads the levers a what-if question asks to change. Deterministic; never clamps or guesses."""
    q = re.sub(r"\s+", " ", (question or "").lower().replace("per cent", "percent")).strip()
    collector = _Collector(baseline or ScenarioParams())
    for extract in (_extract_reps, _extract_contacts, _extract_min_deal, _extract_followup, _extract_cutoff):
        extract(q, collector)
    return collector.result()
