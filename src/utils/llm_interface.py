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
        """Initialize Google Gemini client"""
        try:
            import google.generativeai as genai
            api_key = os.getenv("GEMINI_API_KEY") or self.config.get('llm', {}).get('gemini', {}).get('api_key')
            if api_key and api_key.strip():
                genai.configure(api_key=api_key.strip())
                model_name = self.config.get('llm', {}).get('gemini', {}).get('model', 'gemini-1.5-flash')
                self.gemini_client = genai.GenerativeModel(model_name)
                logger.info(f"Google Gemini client initialized successfully ({model_name})")
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
                continue

        if last_error:
            raise Exception(f"All LLM providers failed. Last error: {last_error}")
        raise Exception("No active LLM providers configured or available.")

    def _generate_gemini(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate text using Google Gemini"""
        generation_config = {}
        if temperature is not None:
            generation_config["temperature"] = temperature
        if max_tokens is not None:
            generation_config["max_output_tokens"] = max_tokens
        resp = self.gemini_client.generate_content(
            prompt,
            generation_config=generation_config if generation_config else None
        )
        return resp.text

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
