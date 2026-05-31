import os
import json
import httpx
from typing import Optional
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential


class OllamaClient:
    def __init__(self, host: str = None, model: str = None, timeout: int = 120):
        self.host = host or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "qwen3:8b")
        self.timeout = timeout
        self._available = None

    def is_available(self) -> bool:
        try:
            resp = httpx.get(f"{self.host}/api/tags", timeout=5)
            self._available = resp.status_code == 200
        except Exception:
            self._available = False
        return self._available

    def list_models(self) -> list[str]:
        try:
            resp = httpx.get(f"{self.host}/api/tags", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
        return []

    def pull_model(self, model: str = None) -> bool:
        model = model or self.model
        try:
            logger.info(f"Pulling model {model}...")
            with httpx.stream(
                "POST",
                f"{self.host}/api/pull",
                json={"name": model},
                timeout=600,
            ) as resp:
                for line in resp.iter_lines():
                    if line:
                        data = json.loads(line)
                        if "status" in data:
                            logger.debug(f"Pull status: {data['status']}")
            return True
        except Exception as e:
            logger.error(f"Failed to pull model {model}: {e}")
            return False

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def generate(self, prompt: str, system: str = None, model: str = None) -> Optional[str]:
        model = model or self.model
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "num_predict": 2048,
            },
        }
        if system:
            payload["system"] = system

        try:
            resp = httpx.post(
                f"{self.host}/api/generate",
                json=payload,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip()
        except httpx.TimeoutException:
            logger.error(f"Ollama request timed out for model {model}")
            raise
        except Exception as e:
            logger.error(f"Ollama generate error: {e}")
            raise

    def generate_json(self, prompt: str, system: str = None, model: str = None) -> Optional[dict]:
        model = model or self.model
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.3,
                "top_p": 0.9,
                "num_predict": 2048,
            },
        }
        if system:
            payload["system"] = system

        try:
            resp = httpx.post(
                f"{self.host}/api/generate",
                json=payload,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            raw = data.get("response", "{}").strip()
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response from Ollama: {e}")
            return None
        except Exception as e:
            logger.error(f"Ollama generate_json error: {e}")
            return None
