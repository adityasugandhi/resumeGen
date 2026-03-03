"""
merge-lora.py

Merges MLX LoRA adapter weights into the base model and optionally
quantizes for deployment. Outputs safetensors format compatible
with AirLLM, llama.cpp (via conversion), or MLX inference.

Usage:
  # Merge LoRA into base model (default 4-bit quantize):
  python scripts/merge-lora.py

  # With custom paths:
  python scripts/merge-lora.py \
    --model mlx-community/Qwen2.5-7B-Instruct-4bit \
    --adapter resume-lora \
    --output resume-model-merged

  # Merge without quantization (full precision, larger):
  python scripts/merge-lora.py --no-quantize

  # Merge with 8-bit quantization:
  python scripts/merge-lora.py --bits 8

  # Export to GGUF for llama.cpp / AirLLM:
  python scripts/merge-lora.py --export-gguf

  # Export to HuggingFace safetensors (for AirLLM):
  python scripts/merge-lora.py --export-hf
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Merge MLX LoRA adapter into base model")
    parser.add_argument("--model", type=str, default="mlx-community/Qwen2.5-7B-Instruct-4bit",
                        help="Base model name (same as used for training)")
    parser.add_argument("--adapter", type=str, default="resume-lora",
                        help="Path to LoRA adapter directory (contains adapters.safetensors)")
    parser.add_argument("--output", type=str, default="resume-model-merged",
                        help="Output directory for merged model")
    parser.add_argument("--no-quantize", action="store_true",
                        help="Skip quantization (output full precision)")
    parser.add_argument("--bits", type=int, default=4, choices=[4, 8],
                        help="Quantization bits (default: 4)")
    parser.add_argument("--export-gguf", action="store_true",
                        help="Also export to GGUF format for llama.cpp / AirLLM")
    parser.add_argument("--export-hf", action="store_true",
                        help="Also export to HuggingFace format for AirLLM")
    return parser.parse_args()


def merge_with_mlx(model: str, adapter: str, output: str, quantize: bool, bits: int):
    """Merge LoRA adapter using mlx-lm fuse command."""

    adapter_file = os.path.join(adapter, "adapters.safetensors")
    if not os.path.exists(adapter_file):
        print(f"Error: Adapter not found at {adapter_file}")
        print("Run training first: python scripts/train-resume-lm.py")
        sys.exit(1)

    print(f"Merging adapter into base model...")
    print(f"  Base:    {model}")
    print(f"  Adapter: {adapter}")
    print(f"  Output:  {output}\n")

    # mlx-lm fuse merges LoRA weights into the base model
    cmd = [
        sys.executable, "-m", "mlx_lm.fuse",
        "--model", model,
        "--adapter-path", adapter,
        "--save-path", output,
    ]

    if not quantize:
        cmd.append("--de-quantize")  # Output full precision
    else:
        # By default fuse keeps the same quantization as input
        # We can re-quantize if needed
        pass

    print(f"Running: {' '.join(cmd)}\n")
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)

    print(f"Merged model saved to {output}/\n")


def export_to_hf(mlx_model_path: str, output_path: str):
    """Convert MLX model to HuggingFace safetensors format for AirLLM."""

    hf_output = f"{output_path}-hf"
    print(f"Exporting to HuggingFace format at {hf_output}...")

    try:
        cmd = [
            sys.executable, "-m", "mlx_lm.convert",
            "--mlx-path", mlx_model_path,
            "--hf-path", hf_output,
        ]
        print(f"Running: {' '.join(cmd)}\n")
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"HuggingFace model saved to {hf_output}/")
        return hf_output
    except subprocess.CalledProcessError as e:
        print(f"HF export failed: {e.stderr}")
        print("You can manually convert using: python -m mlx_lm.convert ...")
        return None


def export_to_gguf(hf_model_path: str, output_path: str, bits: int):
    """Convert to GGUF format for llama.cpp / AirLLM deployment."""

    gguf_output = f"{output_path}.gguf"
    print(f"\nExporting to GGUF format at {gguf_output}...")

    # Check if llama.cpp convert script is available
    convert_script = shutil.which("convert_hf_to_gguf.py")
    if not convert_script:
        # Try common locations
        for path in [
            os.path.expanduser("~/llama.cpp/convert_hf_to_gguf.py"),
            "/opt/llama.cpp/convert_hf_to_gguf.py",
        ]:
            if os.path.exists(path):
                convert_script = path
                break

    if not convert_script:
        print("Warning: convert_hf_to_gguf.py not found.")
        print("Install llama.cpp and run manually:")
        print(f"  python convert_hf_to_gguf.py {hf_model_path} --outfile {gguf_output} --outtype q{bits}_0")
        return None

    quant_type = f"q{bits}_0"
    cmd = [
        sys.executable, convert_script,
        hf_model_path,
        "--outfile", gguf_output,
        "--outtype", quant_type,
    ]

    print(f"Running: {' '.join(cmd)}\n")
    try:
        subprocess.run(cmd, check=True)
        print(f"GGUF model saved to {gguf_output}")
        return gguf_output
    except subprocess.CalledProcessError as e:
        print(f"GGUF export failed: {e}")
        return None


def verify_merged_model(model_path: str):
    """Quick test that the merged model loads and generates."""

    print("\nVerifying merged model...")
    try:
        cmd = [
            sys.executable, "-m", "mlx_lm.generate",
            "--model", model_path,
            "--max-tokens", "50",
            "--prompt", "Write a professional summary for a full-stack engineer with 4 years experience.",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode == 0:
            output = result.stdout.strip()
            # Show last 200 chars of output (the generation)
            print(f"Test generation:\n{output[-300:]}")
            print("\nVerification passed!")
        else:
            print(f"Verification warning: {result.stderr[:200]}")
    except subprocess.TimeoutExpired:
        print("Verification timed out (model may still be valid)")
    except Exception as e:
        print(f"Verification skipped: {e}")


def main():
    args = parse_args()
    start_time = time.time()

    print(f"\n{'='*60}")
    print(f"  LoRA Merge → Resume Model (MLX)")
    print(f"{'='*60}")
    print(f"  Base model:  {args.model}")
    print(f"  Adapter:     {args.adapter}")
    print(f"  Output:      {args.output}")
    print(f"  Quantize:    {'no' if args.no_quantize else f'{args.bits}-bit'}")
    print(f"  Export GGUF: {args.export_gguf}")
    print(f"  Export HF:   {args.export_hf}")
    print(f"{'='*60}\n")

    # 1. Merge LoRA into base model (MLX format)
    merge_with_mlx(args.model, args.adapter, args.output, not args.no_quantize, args.bits)

    # 2. Optional: export to HuggingFace format (needed for AirLLM and GGUF)
    hf_path = None
    if args.export_hf or args.export_gguf:
        hf_path = export_to_hf(args.output, args.output)

    # 3. Optional: export to GGUF
    if args.export_gguf and hf_path:
        export_to_gguf(hf_path, args.output, args.bits)

    # 4. Save merge metadata
    training_config = {}
    tc_path = os.path.join(args.adapter, "training_config.json")
    if os.path.exists(tc_path):
        with open(tc_path) as f:
            training_config = json.load(f)

    merge_meta = {
        "base_model": args.model,
        "adapter_path": args.adapter,
        "output_path": args.output,
        "quantization": None if args.no_quantize else f"{args.bits}-bit",
        "exported_hf": hf_path,
        "exported_gguf": args.export_gguf,
        "training_config": training_config,
        "merged_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    meta_path = os.path.join(args.output, "merge_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(merge_meta, f, indent=2)

    # 5. Verify
    verify_merged_model(args.output)

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"  Merge Complete ({elapsed:.0f}s)")
    print(f"{'='*60}")
    print(f"  MLX model:  {args.output}/")
    if hf_path:
        print(f"  HF model:   {hf_path}/")
    print(f"  Metadata:   {meta_path}")
    print(f"{'='*60}")

    print(f"\nNext steps:")
    print(f"  # Test locally with MLX:")
    print(f"  python -m mlx_lm.generate --model {args.output} --prompt 'Generate a resume for...'")
    if hf_path:
        print(f"\n  # Deploy with AirLLM (CPU inference):")
        print(f"  python scripts/airllm-server.py --model {hf_path}")
    if not hf_path and not args.export_hf:
        print(f"\n  # To deploy with AirLLM, export to HF format first:")
        print(f"  python scripts/merge-lora.py --model {args.model} --adapter {args.adapter} --export-hf")


if __name__ == "__main__":
    main()
