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
import requests
sys.path.append('..')
from src.utils.web_scraper import WebScraper
from src.utils.credibility_checker import CredibilityChecker

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

    def process(self, query_results: List[Any]) -> List[EvidenceResult]:
        """
        Retrieve evidence for all queries.

        Args:
            query_results: List of QueryResult objects

        Returns:
            List of EvidenceResult objects
        """
        logger.info(f"Seeking evidence for {len(query_results)} subclaims")

        results = []
        evidence_id_counter = 0
        for qr in query_results:
            evidence_list = []
            for query in qr.queries:
                # Stage 1: Search
                search_results = self._search_web(query, "HoVER")

                # Stage 2 & 3: Check credibility and extract content
                for url in search_results[:self.max_results]:
                    try:

                        # Content extraction
                        content = self.scraper.scrape(url)
                        content_text = getattr(content, 'text', str(content))[:5000]
                        passages = []
                        # 1. Try LLM extraction if available
                        if self.llm and self.prompt_template:
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

                        # 2. Heuristic extraction fallback (extract top matching sentences or lead paragraph)
                        if not passages and content_text:
                            query_words = set(re.findall(r'\w+', query.lower())) - {'is', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'and', 'what', 'who'}
                            paragraphs = [p.strip() for p in content_text.split('\n') if len(p.strip()) > 40]
                            scored_paras = []
                            for p in paragraphs:
                                p_words = set(re.findall(r'\w+', p.lower()))
                                overlap = len(query_words & p_words)
                                scored_paras.append((overlap, p))
                            scored_paras.sort(key=lambda x: x[0], reverse=True)
                            if scored_paras and scored_paras[0][0] > 0:
                                passages = [scored_paras[0][1][:400]]
                            elif paragraphs:
                                passages = [paragraphs[0][:400]]

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

            results.append(EvidenceResult(
                subclaim_text=qr.subclaim_text,
                queries=qr.queries,
                evidence=evidence_list,
                total_sources=len(evidence_list),
            ))

        return results

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

    
