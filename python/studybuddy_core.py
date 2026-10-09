"""
StudyBuddy ↔ Ollama (gemma4:e4b) low-latency communication module.

Targets sub-5 s total response on a MacBook Air 8 GB by:
  • streaming tokens to stdout the instant they arrive,
  • hard-capping generation at 100 tokens,
  • using orjson for fast chunk decoding,
  • pinning keep_alive=-1 so the model stays resident in RAM.
"""

from __future__ import annotations

import sys
import time
from typing import Generator

import httpx
import orjson

# ── Constants ────────────────────────────────────────────────────────────────

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma4:e4b"

SYSTEM_PROMPT = (
    "You are a lean, low-latency math engine.\n"
    "CONSTRAINTS: NO explanations, NO conversational filler, NO markdown.\n"
    "ROUTING: If simple math/fact -> [SPRINT], output ONLY direct answer. "
    "If complex -> [THINK], use a 3-step Socratic hint (max 50 words).\n"
    'OUTPUT SCHEMA: {"m": "S"|"T", "a": "answer/hint"}'
)

INFERENCE_OPTIONS = {
    "num_predict": 100,   # hard cap — keeps latency tight
    "temperature": 0.1,   # near-deterministic
    "num_thread": 8,      # use all Air cores
}

KEEP_ALIVE = -1  # never evict model from RAM

# Timeout: 2 s connect, 30 s total read (generous fallback)
TIMEOUT = httpx.Timeout(connect=2.0, read=30.0, write=5.0, pool=5.0)


# ── Core class ───────────────────────────────────────────────────────────────

class StudyBuddyCore:
    """Thin, streaming bridge between StudyBuddy and a local Ollama instance."""

    def __init__(
        self,
        url: str = OLLAMA_URL,
        model: str = MODEL,
        system_prompt: str = SYSTEM_PROMPT,
    ) -> None:
        self.url = url
        self.model = model
        self.system_prompt = system_prompt
        # Persistent client — reuses TCP connection across calls
        self._client = httpx.Client(timeout=TIMEOUT)

    # ── public ───────────────────────────────────────────────────────────

    def query(self, user_input: str) -> str:
        """
        Stream a response from Ollama and print tokens in real-time.

        Returns the full concatenated response text once the stream ends.
        Raises ``ConnectionError`` if Ollama is unreachable.
        """
        t_start = time.perf_counter()
        first_token_seen = False
        full_response: list[str] = []

        try:
            for token in self._stream_tokens(user_input):
                if not first_token_seen:
                    ttft = (time.perf_counter() - t_start) * 1000
                    sys.stdout.write(f"\n⚡ first token in {ttft:.0f} ms\n")
                    first_token_seen = True

                # Print each token the moment it arrives (no buffering)
                sys.stdout.write(token)
                sys.stdout.flush()
                full_response.append(token)

        except httpx.ConnectError:
            raise ConnectionError(
                "Could not reach Ollama at "
                f"{self.url} — is 'ollama serve' running?"
            )
        except httpx.ReadTimeout:
            raise TimeoutError("Ollama read timed out (>30 s). Model may be swapping.")

        total_ms = (time.perf_counter() - t_start) * 1000
        result = "".join(full_response)
        sys.stdout.write(f"\n✅ done in {total_ms:.0f} ms\n")
        return result

    # ── private ──────────────────────────────────────────────────────────

    def _build_payload(self, user_input: str) -> bytes:
        """Build the request body as bytes via orjson (faster than json.dumps)."""
        return orjson.dumps({
            "model": self.model,
            "prompt": user_input,
            "system": self.system_prompt,
            "stream": True,
            "format": "json",
            "options": INFERENCE_OPTIONS,
            "keep_alive": KEEP_ALIVE,
        })

    def _stream_tokens(self, user_input: str) -> Generator[str, None, None]:
        """
        POST to Ollama with ``stream=True`` and yield each token as it arrives.

        Ollama returns newline-delimited JSON objects.  Each object has a
        ``response`` field containing the next token fragment.  We decode
        with orjson for minimal CPU overhead.
        """
        payload = self._build_payload(user_input)

        with self._client.stream(
            "POST",
            self.url,
            content=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            response.raise_for_status()

            # Ollama sends one JSON object per line
            for raw_line in response.iter_lines():
                if not raw_line:
                    continue
                try:
                    chunk = orjson.loads(raw_line)
                except orjson.JSONDecodeError:
                    continue  # skip malformed fragments

                token = chunk.get("response", "")
                if token:
                    yield token

                # Ollama signals end-of-stream with {"done": true}
                if chunk.get("done", False):
                    return

    # ── lifecycle ────────────────────────────────────────────────────────

    def close(self) -> None:
        """Release the underlying httpx connection pool."""
        self._client.close()

    def __enter__(self) -> "StudyBuddyCore":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


# ── CLI convenience ──────────────────────────────────────────────────────────

def main() -> None:
    """Interactive REPL for quick testing."""
    print("StudyBuddy Core — type a question (Ctrl-C to quit)\n")

    with StudyBuddyCore() as buddy:
        while True:
            try:
                user_input = input("❓ ").strip()
                if not user_input:
                    continue
                buddy.query(user_input)
                print()  # blank line between answers
            except (KeyboardInterrupt, EOFError):
                print("\nBye!")
                break
            except ConnectionError as e:
                print(f"\n❌ {e}")
                break
            except TimeoutError as e:
                print(f"\n⏰ {e}")


if __name__ == "__main__":
    main()
