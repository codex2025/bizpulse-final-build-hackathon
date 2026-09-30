"""
External Context Gateway.
Provides fresh public market signals (news, plant expansions, regulatory filings)
with source-level provenance, timestamping, freshness indicators, and cached fallbacks.

Per plan D-006 / FR-015 / FR-017: external retrieval is query-dependent (never applied
silently), and this hackathon build uses a validated, labeled snapshot cache instead of
a live web crawl so the demo is reproducible offline (see plan R-006). A signal only
counts toward a decision score after it has been explicitly fetched for that opportunity
in the current session (see mark_fetched / is_fetched) -- this is what lets the UI show
a real "before vs after" score change (plan section 22 demo script, 1:10-1:45).
"""
from typing import Dict, Any, Optional, Set
from datetime import datetime, timezone

# Validated snapshot cache. There is deliberately no hand-written entry here any more:
# every signal is built from a record's own cited `provenance` (real publisher, real URL,
# real published date) by build_signal_from_record(), so nothing in the cache can be
# fictional. Kept as a module-level dict so the lookup path below is unchanged.
CACHED_SIGNALS: Dict[str, Dict[str, Any]] = {}


def _impact_summary(sourced: Dict[str, Any]) -> str:
    """Impact statement composed ONLY from fields under `sourced`; never invents a fact."""
    parts = []
    if sourced.get("investment_label"):
        parts.append(f"{sourced['investment_label']} announced")
    if sourced.get("facility_type"):
        parts.append(str(sourced["facility_type"]))
    if sourced.get("announced_jobs"):
        parts.append(f"{sourced['announced_jobs']:,} announced jobs")
    if sourced.get("operational_target"):
        parts.append(f"operational target: {sourced['operational_target']}")
    if not parts:
        return "Publicly cited facility announcement; see source for details."
    return "Publicly announced: " + "; ".join(parts) + ". A new facility is a live capital-equipment buying window."


def build_signal_from_record(opp: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Builds an external signal from the record's first provenance entry. Returns None
    (no signal) when the record has no usable citation -- we never fabricate one.

    relevance_score is a MODELED value (0.70 base, +0.05 per additional independent
    citation, capped at 0.80); it is labelled as such via `relevance_basis`."""
    prov = [p for p in (opp.get("provenance") or []) if p.get("url")]
    if not prov:
        return None
    primary = prov[0]
    return {
        "title": primary.get("claim", ""),
        "source": primary.get("publisher", ""),
        "url": primary["url"],
        "published_at": primary.get("published_date"),
        "impact_summary": _impact_summary(opp.get("sourced") or {}),
        "relevance_score": round(min(0.80, 0.70 + 0.05 * (len(prov) - 1)), 2),
        "relevance_basis": "Modeled: 0.70 base + 0.05 per additional citation (cap 0.80); not a sourced fact.",
    }


class ExternalContextGateway:
    def __init__(self):
        # Which companies have had context explicitly fetched in the current session.
        # Reset whenever the dataset is (re)loaded so a fresh demo run starts clean.
        self._fetched: Set[str] = set()

    def _match(self, company_name: str) -> Optional[str]:
        for key in CACHED_SIGNALS:
            if key.lower() in company_name.lower() or company_name.lower() in key.lower():
                return key
        return None

    def has_signal(self, company_name: str, embedded: Optional[Dict[str, Any]] = None) -> bool:
        """Whether a validated snapshot exists for this company at all (regardless of
        fetch state) -- either in the built-in cache, or attached to the opportunity
        record itself as `external_signal` (how the seeded demo dataset carries its
        pre-vetted signals for companies outside the hard-coded cache)."""
        return self._match(company_name) is not None or embedded is not None

    def is_fetched(self, company_name: str) -> bool:
        return self._fetch_key(company_name) in self._fetched

    def mark_fetched(self, company_name: str) -> None:
        self._fetched.add(self._fetch_key(company_name))

    def reset(self) -> None:
        self._fetched.clear()

    def fetched_keys(self) -> list:
        """Sorted identities of the companies fetched so far (part of a workspace's state fingerprint)."""
        return sorted(self._fetched)

    def _fetch_key(self, company_name: str) -> str:
        """The identity used to track fetch-state, whether the signal comes from the
        built-in cache (matched key) or is embedded on the opportunity itself (raw name)."""
        return self._match(company_name) or company_name

    def get_signal_for_company(
        self,
        company_name: str,
        only_if_fetched: bool = True,
        embedded: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Returns the signal for a company, stamped with a real retrieval time.

        When only_if_fetched is True (the default used by the decision engine), a signal
        is returned only after mark_fetched() has been called for that company in this
        session -- so external context never silently changes a score; it only changes
        the score once the user has explicitly asked for it via "Fetch fresh context".
        `embedded` is the record's own `external_signal` field, used as a fallback for
        companies not in the built-in cache, normalized to the same shape.
        """
        key = self._match(company_name)
        if only_if_fetched and self._fetch_key(company_name) not in self._fetched:
            return None

        if key:
            res = dict(CACHED_SIGNALS[key])
        elif embedded:
            res = {
                "title": embedded.get("title", f"External signal for {company_name}"),
                "source": embedded.get("source", "Seed dataset"),
                "url": embedded.get("url") or None,
                "published_at": embedded.get("published_at"),
                "impact_summary": embedded.get("impact_summary") or embedded.get("impact", "No impact summary provided."),
                "relevance_score": embedded.get("relevance_score", 0.8),
                "relevance_basis": embedded.get("relevance_basis"),
            }
        else:
            return None

        res["retrieved_at"] = datetime.now(timezone.utc).isoformat()
        res["source_type"] = "validated_snapshot"
        res["freshness_status"] = "Cached validated snapshot (not a live web crawl)"
        return res
