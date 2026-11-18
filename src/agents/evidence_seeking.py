"""
Evidence Seeking Agent - 3-stage evidence retrieval pipeline
Stage 1: Internet Search
Stage 2: Credibility Check
Stage 3: Content Extraction
"""

from typing import List, Dict, Any
from dataclasses import dataclass
from loguru import logger
from datetime import datetime
import yaml
import os
import sys
import re
import math
import requests
sys.path.append('..')
from src.utils.web_scraper import WebScraper
from src.utils.credibility_checker import CredibilityChecker
from src.utils.events import as_emitter

@dataclass
class Evidence:
    """Single piece of evidence"""
    source_url: str
    source_name: str
    passage: str
    retrieved_at: str
    credibility_score: float = 0.85


@dataclass
class EvidenceResult:
    """Result from Evidence Seeking Agent"""
    subclaim_text: str
    queries: List[str]
    evidence: List[Evidence]
    total_sources: int

class EvidenceSeekingAgent:
    """
    Agent 3: Evidence Seeking

    Three-stage pipeline:
    1. Internet Search (DuckDuckGo/SerperAPI)
    2. Credibility Assessment (Heuristic/MBFC)
    3. Content Extraction (BeautifulSoup)
    """

    def __init__(self, config: Dict[str, Any] = None,llm_interface=None):
        """
        Initialize Evidence Seeking Agent.

        Args:
            config: Configuration dictionary
        """
        self.config = config or {}

        # Initialize components
        self.scraper = WebScraper(self.config.get('scraping', {}))
        self.credibility = CredibilityChecker(self.config.get('credibility', {}))

        # Configuration
        self.max_results = self.config.get('max_search_results', 10)
        self.credibility_threshold = self.config.get('credibility_threshold', 'medium')
        self.max_passages = self.config.get('max_passages_per_source', 3)
        # LLM extraction costs one call per web page and rewrites the source text, which
        # would make the debate's quote check verify paraphrases. Off by default.
        self.use_llm_extraction = bool(self.config.get('llm_extraction', False))
        self.passages_per_page = int(self.config.get('passages_per_page', 3))
        self.passage_chars = int(self.config.get('passage_chars', 500))
        self.llm = llm_interface
        logger.info("Evidence Seeking Agent initialized")
        
        # Load prompts
        self.prompt_template = None
        try:
            prompt_path = os.path.join(os.path.dirname(__file__), '../../config/agent_prompt.yaml')
            with open(prompt_path, 'r') as f:
                self.prompt_template = yaml.safe_load(f).get('evidence_seeking', '')
        except Exception as e:
            logger.warning(f"Could not load agent_prompt.yaml: {e}")

    def process(self, query_results: List[Any], on_event=None) -> List[EvidenceResult]:
        """
        Retrieve evidence for all queries.

        Args:
            query_results: List of QueryResult objects

        Returns:
            List of EvidenceResult objects
        """
        logger.info(f"Seeking evidence for {len(query_results)} subclaims")

        emit = as_emitter(on_event)
        results = []
        evidence_id_counter = 0
        for qi, qr in enumerate(query_results):
            evidence_list = []
            for query in qr.queries:
                # Stage 1: Search
                emit("search", subclaim_index=qi, query=query)
                search_results = self._search_web(query, "HoVER")

                # Stage 2 & 3: Check credibility and extract content
                for url in search_results[:self.max_results]:
                    try:

                        # Content extraction
                        content = self.scraper.scrape(url)
                        full_text = getattr(content, 'text', str(content)) or ''
                        content_text = full_text[:5000]
                        passages = []
                        # 1. Optional LLM extraction
                        if self.use_llm_extraction and self.llm and self.prompt_template:
                            try:
                                prompt = self.prompt_template.format(
                                    query=query,
                                    content=content_text
                                )
                                extracted = self.llm.generate(prompt=prompt)
                                if extracted and "None" not in extracted and len(extracted.strip()) > 15:
                                    passages = [extracted.strip()]
                            except Exception as llm_err:
                                logger.debug(f"LLM extraction skipped: {llm_err}")

                        # 2. Keyword extraction: the source's own best-matching sentences
                        if not passages and full_text:
                            passages = self._best_passages(full_text, query, qr.subclaim_text or '')

                        cred_score = self.credibility.assess(url)
                        for passage in passages:
                            evidence = Evidence(
                                source_url=url,
                                source_name=content.title or url,
                                passage=passage,
                                retrieved_at=datetime.utcnow().isoformat(),
                                credibility_score=cred_score,
                            )
                            evidence_list.append(evidence)
                            evidence_id_counter += 1

                    except Exception as e:
                        logger.error(f"Error processing {url}: {e}")
                        continue

            emit("evidence", subclaim_index=qi, count=len(evidence_list), sources=[
                {"name": ev.source_name, "url": ev.source_url} for ev in evidence_list[:8]
            ])
            results.append(EvidenceResult(
                subclaim_text=qr.subclaim_text,
                queries=qr.queries,
                evidence=evidence_list,
                total_sources=len(evidence_list),
            ))

        return results

    _STOP = {
        'is', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'and', 'what', 'who', 'did', 'was', 'does',
        'his', 'her', 'their', 'that', 'this', 'with', 'by', 'on', 'at', 'as', 'it', 'be', 'were',
        'are', 'from', 'verify', 'which', 'when', 'where', 'how', 'whether', 'has', 'have', 'had',
    }

    def _best_passages(self, text: str, query: str, subclaim: str) -> List[str]:
        """
        Pick the sentences anywhere on the page that share the most keywords with the
        query and subclaim, each extended with the following sentence for context.
        Works on sentences because scraped pages often have no paragraph breaks.
        """
        def stems(t: str) -> set:
            # crude stemming so 'theory' matches 'theoretical'
            return {w[:5] if len(w) > 5 else w for w in re.findall(r'\w+', t.lower()) if w not in self._STOP}

        keywords = stems(f"{query} {subclaim}")
        if not keywords:
            return []
        text = re.sub(r'\[\s*\d+\s*\]', ' ', text)  # drop citation markers like [ 52 ]
        sentences = [x.strip() for x in re.split(r'(?<=[.!?])\s+', text) if x.strip()]
        # skip fragments and unpunctuated blobs (menus, infoboxes)
        candidates = [(i, stems(x)) for i, x in enumerate(sentences) if 30 <= len(x) <= 600]
        if not candidates:
            return []
        # Rare keywords count more: on Einstein's own page "einstein" is everywhere
        # and says little, while "nobel" pinpoints the relevant sentences.
        n = len(candidates)
        idf = {k: math.log((n + 1) / (1 + sum(k in st for _, st in candidates))) for k in keywords}
        scored = []
        for i, st in candidates:
            hits = keywords & st
            if len(hits) >= 2:
                # Leads summarise the key facts (inverted pyramid): small boost near the top
                lead_boost = 1.25 if i < 0.1 * len(sentences) else 1.0
                scored.append((sum(idf[k] for k in hits) * lead_boost, i))
        scored.sort(key=lambda x: (-x[0], x[1]))

        passages, used = [], set()
        for _, i in scored:
            if len(passages) >= self.passages_per_page:
                break
            if i in used:
                continue
            passage, j = sentences[i], i + 1
            used.add(i)
            while j < len(sentences) and len(passage) + len(sentences[j]) < self.passage_chars and len(sentences[j]) <= 600:
                passage += " " + sentences[j]
                used.add(j)
                j += 1
            passages.append(passage[: self.passage_chars])
        return passages

    def _search_web(self, query: str, dataset: str = "general") -> List[str]:
        """
        Search Wikipedia and web search sources for a query.
        """
        results = []
        # Primary: Wikipedia search
        wiki_results = self._search_wikipedia(query)
        results.extend(wiki_results)

        # Secondary: DuckDuckGo search if available
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                ddg_res = list(ddgs.text(query, max_results=3))
                for item in ddg_res:
                    href = item.get('href')
                    if href and href not in results:
                        results.append(href)
        except Exception as ddg_err:
            logger.debug(f"DDG search fallback error: {ddg_err}")

        return results[:self.max_results]

    def _search_wikipedia(self, query: str) -> List[str]:
        """Search using Wikipedia Free API"""
        try:
            # Clean up the query if it contains site:wikipedia.org from earlier versions
            clean_query = query.replace(" site:wikipedia.org", "").strip()
            
            url = "https://en.wikipedia.org/w/api.php"
            params = {
                "action": "query",
                "list": "search",
                "srsearch": clean_query,
                "format": "json",
                "srlimit": 2
            }
            headers = {
                'User-Agent': 'ResearchTool/1.0'
            }
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            results = []
            if "query" in data and "search" in data["query"]:
                for item in data["query"]["search"]:
                    title = item["title"].replace(" ", "_")
                    results.append(f"https://en.wikipedia.org/wiki/{title}")
                    
            return results
        except Exception as e:
            logger.error(f"Wikipedia search error: {e}")
            return []

    
