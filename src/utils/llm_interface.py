"""
LLM Interface - Unified interface for Ollama (free) and OpenAI (paid) LLMs
Provides automatic fallback and retry logic for robust operation
"""

import os
import time
from typing import Optional, Dict, Any, List
from enum import Enum
import yaml
from pathlib import Path
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
import json
import re

try:
    from dotenv import load_dotenv
    load_dotenv()  # pick up GEMINI_API_KEY etc. from .env when run outside Next.js
except ImportError:
    pass


class LLMProvider(Enum):
    """Supported LLM providers"""
    OLLAMA = "ollama"
    OPENAI = "openai"
    GEMINI = "gemini"


class LLMInterface:
    """
    Unified interface for multiple LLM providers with fallback support.

    Usage:
        llm = LLMInterface()
        response = llm.generate("What is the capital of France?")
    """

    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize LLM interface with configuration.

        Args:
            config_path: Path to api_config.yaml file
        """
        self.config_path = config_path or self._find_config()
        self.config = self._load_config()

        # Initialize providers
        self.ollama_client = None
        self.openai_client = None
        self.gemini_client = None

        self._setup_providers()

    def _find_config(self) -> str:
        """Find configuration file in project structure"""
        possible_paths = [
            Path("config/api_config.yaml"),
            Path("../config/api_config.yaml"),
            Path("../../config/api_config.yaml"),
        ]

        for path in possible_paths:
            if path.exists():
                return str(path)

        logger.warning("api_config.yaml not found, using defaults")
        return None

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        if not self.config_path or not Path(self.config_path).exists():
            return self._default_config()

        with open(self.config_path, 'r') as f:
            config = yaml.safe_load(f)

        # Replace environment variables
        config = self._replace_env_vars(config)
        return config

    def _default_config(self) -> Dict[str, Any]:
        """Return default configuration"""
        return {
            'llm': {
                'primary_provider': 'ollama',
                'fallback_provider': None,
                'ollama': {
                    'base_url': 'http://localhost:11434',
                    'model': 'llama3.2:3b',
                    'timeout': 60,
                    'temperature': 0.3,
                    'max_tokens': 2048
                }
            }
        }

    def _replace_env_vars(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Replace ${VAR} with environment variable values"""
        config_str = json.dumps(config)

        # Find all ${VAR} patterns
        import re
        pattern = r'\$\{([^}]+)\}'

        for match in re.finditer(pattern, config_str):
            var_name = match.group(1)
            var_value = os.getenv(var_name, '')
            config_str = config_str.replace(f'${{{var_name}}}', var_value)

        return json.loads(config_str)

    def _setup_providers(self):
        """Initialize LLM provider clients"""
        llm_config = self.config.get('llm', {})

        # Setup Ollama (free, primary if available)
        self._setup_ollama()

        # Setup Gemini
        self._setup_gemini()

        # Setup OpenAI
        self._setup_openai()

    def _setup_gemini(self):
        """Initialize Google Gemini client (google-genai SDK)"""
        try:
            from google import genai
            from google.genai import types
            gemini_cfg = self.config.get('llm', {}).get('gemini', {})
            api_key = os.getenv("GEMINI_API_KEY") or gemini_cfg.get('api_key')
            if api_key and api_key.strip() and not api_key.startswith('${'):
                timeout_ms = int(gemini_cfg.get('timeout', 60)) * 1000
                self.gemini_client = genai.Client(
                    api_key=api_key.strip(),
                    http_options=types.HttpOptions(timeout=timeout_ms),
                )
                self.gemini_model = gemini_cfg.get('model', 'gemini-2.5-flash')
                # Free-tier quota is per model: when one is used up, move to the next
                self.gemini_models = [self.gemini_model] + [
                    m for m in gemini_cfg.get('fallback_models', []) if m != self.gemini_model
                ]
                self.gemini_exhausted = set()
                logger.info(f"Google Gemini client initialized successfully ({', '.join(self.gemini_models)})")
            else:
                self.gemini_client = None
        except Exception as e:
            logger.warning(f"Failed to initialize Gemini: {e}")
            self.gemini_client = None

    def _setup_ollama(self):
        """Initialize Ollama client"""
        try:
            import ollama
            self.ollama_client = ollama
            logger.info("Ollama client initialized")
        except ImportError:
            logger.warning("Ollama package not installed")
            self.ollama_client = None
        except Exception as e:
            logger.error(f"Failed to initialize Ollama: {e}")
            self.ollama_client = None

    def _setup_openai(self):
        """Initialize OpenAI client"""
        try:
            from openai import OpenAI
            api_key = os.getenv("OPENAI_API_KEY") or self.config.get('llm', {}).get('openai', {}).get('api_key')
            if api_key and api_key.strip():
                self.openai_client = OpenAI(api_key=api_key.strip())
                logger.info("OpenAI client initialized successfully")
            else:
                self.openai_client = None
        except ImportError:
            self.openai_client = None
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI: {e}")
            self.openai_client = None

    def generate(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        provider: Optional[LLMProvider] = None
    ) -> str:
        """
        Generate text using configured LLM with automatic fallback.
        """
        # Determine candidate providers in order
        providers = []
        if provider:
            providers.append(provider.value)
        else:
            if self.gemini_client:
                providers.append('gemini')
            if self.openai_client:
                providers.append('openai')
            if self.ollama_client:
                providers.append('ollama')

        last_error = None
        failures = []
        for prov_name in providers:
            try:
                if prov_name == 'gemini' and self.gemini_client:
                    return self._generate_gemini(prompt, temperature, max_tokens)
                elif prov_name == 'openai' and self.openai_client:
                    return self._generate_openai(prompt, temperature, max_tokens)
                elif prov_name == 'ollama' and self.ollama_client:
                    return self._call_ollama(prompt, temperature, max_tokens)
            except Exception as e:
                logger.warning(f"{prov_name} generation failed: {e}")
                last_error = e
                failures.append(f"{prov_name}: {str(e)[:200]}")
                continue

        if last_error:
            raise Exception("All LLM providers failed. " + " | ".join(failures))
        raise Exception("No active LLM providers configured or available.")

    def _generate_gemini(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Generate text with Gemini. Tries the configured model first, then each fallback
        model; a model whose daily quota is used up is skipped for the rest of the run.
        """
        if not hasattr(self, 'gemini_exhausted'):
            self.gemini_exhausted = set()
        all_models = getattr(self, 'gemini_models', None) or [self.gemini_model]
        models = [m for m in all_models if m not in self.gemini_exhausted]
        last_error: Optional[Exception] = None
        for model in models:
            try:
                return self._gemini_call(model, prompt, temperature, max_tokens)
            except RuntimeError as e:
                if "quota exhausted" not in str(e):
                    raise
                self.gemini_exhausted.add(model)
                last_error = e
                logger.warning(f"Gemini quota exhausted for {model}; trying next model")
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini model {model} failed ({str(e)[:120]}); trying next model")
        if all(m in self.gemini_exhausted for m in all_models):
            raise RuntimeError("Gemini quota exhausted on every configured model "
                               f"({', '.join(all_models)}). Enable billing on the API key or try again later.")
        raise last_error or RuntimeError("No Gemini model available")

    def _gemini_call(self, model: str, prompt: str, temperature: Optional[float], max_tokens: Optional[int]) -> str:
        """One Gemini model, retrying short rate limits (429) and overload (503)."""
        from google.genai import types, errors
        gemini_cfg = self.config.get('llm', {}).get('gemini', {})
        config = types.GenerateContentConfig(
            temperature=temperature if temperature is not None else gemini_cfg.get('temperature', 0.2),
            max_output_tokens=max_tokens,
        )
        max_retries = int(gemini_cfg.get('max_retries', 5))
        for attempt in range(max_retries + 1):
            try:
                resp = self.gemini_client.models.generate_content(
                    model=model, contents=prompt, config=config
                )
                if not resp.text:
                    raise RuntimeError("Gemini returned an empty response")
                return resp.text
            except errors.APIError as e:
                if e.code not in (429, 500, 503) or attempt == max_retries:
                    raise
                # Honour the server's suggested delay when it gives one
                m = re.search(r"retry in ([\d.]+)s|'retryDelay': '(\d+)s'", str(e))
                delay = float(next(g for g in m.groups() if g)) if m else min(60, 2 ** (attempt + 1))
                max_wait = float(gemini_cfg.get('max_retry_wait', 60))
                if delay > max_wait:
                    # A long suggested wait means the daily quota is used up, not a
                    # short burst limit: fail now instead of sleeping for hours.
                    raise RuntimeError(
                        f"Gemini quota exhausted (server asks to wait {delay / 3600:.1f}h). "
                        f"Enable billing on the API key or try again later."
                    ) from e
                logger.warning(f"Gemini {e.code}, retrying in {delay:.0f}s ({attempt + 1}/{max_retries})")
                time.sleep(delay)

    def _generate_ollama(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        role: str = 'user'
    ) -> str:
        """Safe wrapper for backward compatibility with agents calling _generate_ollama"""
        try:
            return self.generate(prompt=prompt, temperature=temperature, max_tokens=max_tokens)
        except Exception:
            return self._call_ollama(prompt, temperature, max_tokens, role)

    def _call_ollama(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        role: str = 'user'
    ) -> str:
        """Execute call to Ollama backend"""
        if not self.ollama_client:
            raise RuntimeError("Ollama client not available")
        ollama_config = self.config.get('llm', {}).get('ollama', {})
        messages = [{'role': role, 'content': prompt}]
        options = {
            'temperature': temperature or ollama_config.get('temperature', 0.3),
            'num_predict': max_tokens or ollama_config.get('max_tokens', 2048)
        }
        response = self.ollama_client.chat(
            model=ollama_config.get('model', 'llama3.2:3b'),
            messages=messages,
            options=options
        )
        return response.message.content

    def _generate_openai(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        role: str = 'user'
    ) -> str:
        """Generate text using OpenAI"""
        openai_config = self.config.get('llm', {}).get('openai', {})
        messages = [{'role': role, 'content': prompt}]
        response = self.openai_client.chat.completions.create(
            model=openai_config.get('model', 'gpt-4o-mini'),
            messages=messages,
            temperature=temperature or openai_config.get('temperature', 0.3),
            max_tokens=max_tokens or openai_config.get('max_tokens', 2048)
        )
        return response.choices[0].message.content

        return response.choices[0].message.content

    def generate_structured(
        self,
        prompt: str,
        output_schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate structured JSON output matching a schema.

        Args:
            prompt: User prompt
            output_schema: Expected JSON schema

        Returns:
            Parsed JSON matching schema
        """
        schema_str = json.dumps(output_schema, indent=2)

        full_prompt = f"""{prompt}

Please respond with ONLY a valid JSON object matching this schema:
{schema_str}

Do not include any explanation, just the JSON."""

        response = self.generate(full_prompt)

        # Extract JSON from response
        try:
            # Try direct parsing
            return json.loads(response)
        except json.JSONDecodeError:
            # Try extracting JSON from markdown code blocks
            import re
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))

            # Try extracting any JSON object
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))

            raise ValueError(f"Could not parse JSON from response: {response}")


# Convenience function for quick usage
def get_llm() -> LLMInterface:
    """Get configured LLM interface singleton"""
    if not hasattr(get_llm, '_instance'):
        get_llm._instance = LLMInterface()
    return get_llm._instance
