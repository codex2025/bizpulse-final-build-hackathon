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

# Validated snapshot cache for hackathon reliability & offline safety.
# published_at is fixed (as if captured when this snapshot was validated); retrieved_at
# is stamped for real, the moment a user in this session actually requests it.
CACHED_SIGNALS = {
    "Titan Heavy Hydraulics": {
        "title": "Titan Heavy Hydraulics Secures $42M Defense Component Contract, Plans Ohio Facility Expansion",
        "source": "Midwest Manufacturing Today",
        "url": "https://midwestmfg.example.com/news/titan-expansion-2026",
        "published_at": "2026-09-26T08:15:00Z",
        "impact_summary": "High expansion budget drastically increases likelihood of multi-unit equipment purchase.",
        "relevance_score": 0.95
    },
    "Apex Precision Tooling": {
        "title": "Auto OEM Tier-1 Suppliers Face Bottlenecks in Precision Metal Parts",
        "source": "Automotive News Wire",
        "url": "https://autonews.example.com/tier1-supply-chain-crunch",
        "published_at": "2026-09-25T19:40:00Z",
        "impact_summary": "Urgency to secure reliable machining supplier creates strong negotiation leverage.",
        "relevance_score": 0.88
    },
    "Sterling Turbine Solutions": {
        "title": "Texas Grid Operator ERCOT Announces Incentives for Industrial Cogeneration Turbines",
        "source": "Energy & Power Journal",
        "url": "https://energyjournal.example.com/ercot-industrial-incentives-2026",
        "published_at": "2026-09-26T06:30:00Z",
        "impact_summary": "State tax rebate offsets up to 18% of equipment costs, accelerating buying timeline.",
        "relevance_score": 0.82
    },
    "Vanguard Robotics & Automation": {
        "title": "Vanguard Robotics Secures $30M Series B to Accelerate Automated Fulfillment Systems",
        "source": "TechCrunch Robotics",
        "url": "https://techcrunch.example.com/vanguard-robotics-series-b",
        "published_at": "2026-09-26T07:45:00Z",
        "impact_summary": "Series B capitalization ensures zero credit/payment default risk; immediate close target.",
        "relevance_score": 0.96
    },
    "Midwest Foundry Works": {
        "title": "Industrial Energy Rates in Wisconsin Drop 14% as Gas Storage Peaks",
        "source": "Great Lakes Energy Gazette",
        "url": "https://glegazette.example.com/wisconsin-industrial-gas-drop",
        "published_at": "2026-09-24T12:00:00Z",
        "impact_summary": "Key barrier (energy cost volatility) removed; opportune moment to re-engage.",
        "relevance_score": 0.75
    },
    "Delta Marine Propulsion": {
        "title": "EPA Tightens Mississippi River Tugboat Emission Standards with Strict Dec 31 Enforcement",
        "source": "Maritime Executive",
        "url": "https://maritime-executive.example.com/epa-tugboat-standards-2026",
        "published_at": "2026-09-25T11:20:00Z",
        "impact_summary": "Regulatory deadline enforces immediate buying urgency within the next 45 days.",
        "relevance_score": 0.89
    }
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
                "url": embedded.get("url", "#"),
                "published_at": embedded.get("published_at"),
                "impact_summary": embedded.get("impact_summary") or embedded.get("impact", "No impact summary provided."),
                "relevance_score": embedded.get("relevance_score", 0.8),
            }
        else:
            return None

        res["retrieved_at"] = datetime.now(timezone.utc).isoformat()
        res["source_type"] = "validated_snapshot"
        res["freshness_status"] = "Cached validated snapshot (not a live web crawl)"
        return res
