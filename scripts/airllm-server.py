"""
airllm-server.py

FastAPI server wrapping AirLLM for local CPU inference of the
fine-tuned resume generation model. Supports both AirLLM (layer-streaming)
and llama-cpp-python (GGUF) backends.

Usage:
  # AirLLM backend (safetensors):
  python scripts/airllm-server.py --model resume-model-merged

  # llama.cpp backend (GGUF, faster on CPU):
  python scripts/airllm-server.py --model resume-model-merged-gguf/model.gguf --backend llama-cpp

  # Custom port:
  python scripts/airllm-server.py --model resume-model-merged --port 8100

API Endpoints:
  POST /generate    — Generate a tailored resume
  POST /health      — Health check
  GET  /info        — Model info and capabilities
"""

import argparse
import json
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn


# ── Request/Response Models ─────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    """Request body for resume generation."""
    job_title: str = Field(..., description="Target job title")
    company: str = Field(..., description="Target company name")
    job_description: Optional[str] = Field(None, description="Full job description text")
    requirements: list[str] = Field(default_factory=list, description="Key job requirements")
    career_context: Optional[str] = Field(None, description="Additional career context for RAG")
    max_tokens: int = Field(3000, ge=100, le=8000, description="Max tokens to generate")
    temperature: float = Field(0.3, ge=0.0, le=1.0, description="Sampling temperature")


class GenerateResponse(BaseModel):
    """Response body with generated resume."""
    latex: str = Field(..., description="Generated LaTeX resume content")
    tokens_generated: int = Field(..., description="Number of tokens generated")
    generation_time_seconds: float = Field(..., description="Time taken for generation")
    model: str = Field(..., description="Model identifier")


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    backend: str
    model_path: str


class ModelInfo(BaseModel):
    model_path: str
    backend: str
    max_seq_length: int
    quantization: Optional[str]


# ── Model Backend Abstraction ───────────────────────────────────────────────

class ModelBackend:
    """Base class for model backends."""

    def generate(self, prompt: str, max_tokens: int, temperature: float) -> tuple[str, int]:
        raise NotImplementedError


class MLXBackend(ModelBackend):
    """MLX backend for Apple Silicon — fastest option on M-series Macs."""

    def __init__(self, model_path: str, max_seq_length: int = 4096, adapter_path: str | None = None):
        import mlx_lm

        print(f"Loading MLX model from {model_path}...")
        if adapter_path:
            print(f"  with adapter: {adapter_path}")
            self.model, self.tokenizer = mlx_lm.load(model_path, adapter_path=adapter_path)
        else:
            self.model, self.tokenizer = mlx_lm.load(model_path)
        self.max_seq_length = max_seq_length
        print("MLX model loaded!")

    def generate(self, prompt: str, max_tokens: int, temperature: float) -> tuple[str, int]:
        import mlx_lm
        from mlx_lm.sample_utils import make_sampler

        sampler = make_sampler(temp=max(temperature, 0.01), top_p=0.9)

        response = mlx_lm.generate(
            self.model,
            self.tokenizer,
            prompt=prompt,
            max_tokens=max_tokens,
            sampler=sampler,
            verbose=False,
        )

        token_count = len(self.tokenizer.encode(response))
        return response, token_count


class AirLLMBackend(ModelBackend):
    """AirLLM layer-streaming backend for safetensors models."""

    def __init__(self, model_path: str, max_seq_length: int = 4096):
        from airllm import AutoModel
        from transformers import AutoTokenizer

        print(f"Loading AirLLM model from {model_path}...")
        self.model = AutoModel.from_pretrained(
            model_path,
            compression="4bit",
            device="cpu",
        )
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.max_seq_length = max_seq_length
        print("AirLLM model loaded!")

    def generate(self, prompt: str, max_tokens: int, temperature: float) -> tuple[str, int]:
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=self.max_seq_length - max_tokens,
        )

        outputs = self.model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=max(temperature, 0.01),  # AirLLM needs non-zero
            do_sample=temperature > 0,
            top_p=0.9,
        )

        # Decode only the new tokens
        input_len = inputs["input_ids"].shape[1]
        new_tokens = outputs[0][input_len:]
        text = self.tokenizer.decode(new_tokens, skip_special_tokens=True)
        return text, len(new_tokens)


class LlamaCppBackend(ModelBackend):
    """llama-cpp-python backend for GGUF models (faster on CPU)."""

    def __init__(self, model_path: str, max_seq_length: int = 4096):
        from llama_cpp import Llama

        print(f"Loading llama.cpp model from {model_path}...")
        self.model = Llama(
            model_path=model_path,
            n_ctx=max_seq_length,
            n_threads=os.cpu_count() or 4,
            verbose=False,
        )
        self.max_seq_length = max_seq_length
        print("llama.cpp model loaded!")

    def generate(self, prompt: str, max_tokens: int, temperature: float) -> tuple[str, int]:
        output = self.model(
            prompt,
            max_tokens=max_tokens,
            temperature=max(temperature, 0.01),
            top_p=0.9,
            stop=["<|im_end|>", "<|endoftext|>"],
        )

        text = output["choices"][0]["text"]
        tokens = output["usage"]["completion_tokens"]
        return text, tokens


# ── Prompt Construction ─────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are Aditya Sugandhi's personal resume assistant. "
    "You generate and tailor LaTeX resumes using ONLY the personal facts, work history, "
    "education, and projects provided in the input. NEVER invent names, companies, "
    "degrees, dates, or credentials. The candidate is always Aditya Sugandhi. "
    "Work history includes ONLY Florida State University and Aspire Systems. "
    "Education includes ONLY M.S. from FSU and B.Tech from SRM Institute. "
    "Follow the master template: Charter font, 10pt, metablue (RGB 24,119,242) "
    "section rules, 0.225in margins. Every bullet uses the formula: "
    "Action Verb + System/Tool + Scale + Metric + Business Impact. "
    "Output ONLY valid LaTeX code starting with \\documentclass."
)


PERSONAL_FACTS = """=== PERSONAL FACTS (use ONLY these — never invent) ===
Name: Aditya Sugandhi
Phone: +1 448 500 6857
Email: adityasugandhi.work@outlook.com
GitHub: https://github.com/adityasugandhi
Website: https://adityasugandhi.com
Location: Tallahassee, FL (open to relocation)

WORK HISTORY (use ONLY these companies and titles):
1. Software Engineer II | Florida State University | Nov 2024 – Present | Tallahassee, FL
   - IoT management platform, 35K+ devices, 172+ networks, 10K+ users
   - React.js frontend, Python/FastAPI backend, 37 REST/gRPC APIs
   - Event-driven microservices (AWS Lambda, SQS, SNS)
   - CI/CD with GitHub Actions, Docker, CloudFormation
   - AI-assisted development (Claude Code, GitHub Copilot)

2. Systems Engineer | Aspire Systems | Jan 2021 – Jul 2023 | Chennai, India
   - Distributed utility asset management platform
   - Java/Spring Boot microservices, Apache Kafka, Kubernetes
   - 500K+ IoT sensors, 5M+ telemetry events/day, 99.99% availability
   - gRPC migration (84% latency improvement), PostgreSQL sharding
   - Event-driven architecture, compliance monitoring with OPA

3. Associate Software Engineer | Aspire Systems | Jun 2019 – Jan 2021 | Chennai, India
   - Early career role, same platform, grew into Systems Engineer

EDUCATION (use ONLY these):
1. M.S. Computer Science | Florida State University | Tallahassee, FL
   - Advisor: Prof. Olmo Zavala Romero
2. B.Tech Computer Science | SRM Institute of Science and Technology | Chennai, India

PUBLICATIONS & AWARDS (use ONLY these — do NOT invent any certifications):
- Review Classification & False Feedback Detection (IJAST)
- 2nd Place, SRM University Hackathon (2019)
- AWS Solutions Architect Course (Udemy, 2024) — this is a COURSE, not a certification

REAL PROJECTS (use for Projects section):
- AI-Powered Resume Platform: Next.js 14, Claude Sonnet, LanceDB vector memory, 11 autonomous tools, LaTeX compilation
- Utility Digital Twin Platform: Java, Kafka, InfluxDB, 50M events/day, real-time anomaly detection
- BookedFlow Slack Bot: Node.js, Slack API, Socket Mode, OAuth 2.0, PM2, AWS EC2
- Building Information Portal: Role-based access, multi-criteria search, 14.6M+ sq ft, 10K+ users
- SkillSync MCP: TypeScript MCP server, 60+ threat patterns, 8 IDE integrations, npm published

TEMPLATE FORMAT:
- Charter font, 10pt, metablue color = RGB(24,119,242), 0.225in margins
- Do NOT include Certifications, Interests, or Awards sections unless the facts above support them
=== END PERSONAL FACTS ==="""


def build_prompt(req: GenerateRequest) -> str:
    """Build the chat-formatted prompt for the model."""
    user_parts = [
        f"Generate a tailored LaTeX resume for a {req.job_title} position at {req.company}.",
        f"\n{PERSONAL_FACTS}",
    ]

    if req.job_description:
        user_parts.append(f"\nJob Description:\n{req.job_description}")

    if req.requirements:
        reqs_text = "\n".join(f"- {r}" for r in req.requirements)
        user_parts.append(f"\nKey Requirements:\n{reqs_text}")

    if req.career_context:
        user_parts.append(f"\nCareer Context:\n{req.career_context}")

    user_msg = "\n".join(user_parts)

    # Format as Qwen chat template
    prompt = (
        f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n"
        f"<|im_start|>user\n{user_msg}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )

    return prompt


# ── Server ──────────────────────────────────────────────────────────────────

# Global state
model_backend: Optional[ModelBackend] = None
server_config: dict = {}


def create_app(args) -> FastAPI:
    """Create the FastAPI application."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        global model_backend, server_config

        server_config = {
            "model_path": args.model,
            "backend": args.backend,
            "max_seq_length": args.max_seq_length,
            "quantization": "4bit" if args.backend == "airllm" else "gguf",
        }

        # Load model on startup
        if args.backend == "mlx":
            model_backend = MLXBackend(args.model, args.max_seq_length, args.adapter_path)
        elif args.backend == "llama-cpp":
            model_backend = LlamaCppBackend(args.model, args.max_seq_length)
        else:
            model_backend = AirLLMBackend(args.model, args.max_seq_length)

        yield

        # Cleanup
        model_backend = None

    app = FastAPI(
        title="Resume LLM Server",
        description="Local CPU inference for fine-tuned resume generation",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS for Next.js frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_methods=["POST", "GET"],
        allow_headers=["*"],
    )

    @app.post("/generate", response_model=GenerateResponse)
    async def generate_resume(req: GenerateRequest):
        """Generate a tailored LaTeX resume."""
        if model_backend is None:
            raise HTTPException(503, "Model not loaded")

        prompt = build_prompt(req)
        start_time = time.time()

        try:
            text, token_count = model_backend.generate(
                prompt, req.max_tokens, req.temperature
            )
        except Exception as e:
            raise HTTPException(500, f"Generation failed: {str(e)}")

        elapsed = time.time() - start_time

        # Extract LaTeX if wrapped in code fences
        latex = text.strip()
        if "```latex" in latex:
            start = latex.index("```latex") + len("```latex")
            end = latex.index("```", start) if "```" in latex[start:] else len(latex)
            latex = latex[start:end].strip()
        elif "```" in latex:
            start = latex.index("```") + 3
            end = latex.index("```", start) if "```" in latex[start:] else len(latex)
            latex = latex[start:end].strip()

        return GenerateResponse(
            latex=latex,
            tokens_generated=token_count,
            generation_time_seconds=round(elapsed, 2),
            model=server_config["model_path"],
        )

    @app.get("/health", response_model=HealthResponse)
    async def health_check():
        """Health check endpoint."""
        return HealthResponse(
            status="ok" if model_backend else "loading",
            model_loaded=model_backend is not None,
            backend=server_config.get("backend", "unknown"),
            model_path=server_config.get("model_path", ""),
        )

    @app.get("/info", response_model=ModelInfo)
    async def model_info():
        """Return model configuration info."""
        return ModelInfo(**server_config)

    return app


# ── Entry Point ─────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="AirLLM Resume Generation Server")
    parser.add_argument("--model", type=str, default="resume-model-merged",
                        help="Path to merged model or GGUF file")
    parser.add_argument("--backend", type=str, default="mlx",
                        choices=["mlx", "airllm", "llama-cpp"],
                        help="Inference backend (mlx for Apple Silicon, airllm for CPU streaming, llama-cpp for GGUF)")
    parser.add_argument("--adapter-path", type=str, default=None,
                        help="LoRA adapter path for MLX backend (use base model + adapter instead of merged)")
    parser.add_argument("--port", type=int, default=8100,
                        help="Server port")
    parser.add_argument("--host", type=str, default="127.0.0.1",
                        help="Server host")
    parser.add_argument("--max-seq-length", type=int, default=4096,
                        help="Maximum sequence length")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    print(f"\n{'='*60}")
    print(f"  Resume LLM Server")
    print(f"{'='*60}")
    print(f"  Model:   {args.model}")
    print(f"  Backend: {args.backend}")
    print(f"  Port:    {args.port}")
    print(f"{'='*60}\n")

    app = create_app(args)
    uvicorn.run(app, host=args.host, port=args.port)
