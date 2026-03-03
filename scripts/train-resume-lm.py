"""
train-resume-lm.py

LoRA fine-tuning of Qwen 2.5 7B Instruct on personal resume data
using Apple MLX for native Apple Silicon training (M4 Pro Max, 36GB).

MLX uses unified memory — the full 7B model + LoRA adapters fit
comfortably in 36GB without quantization during training.

Usage:
  # Install deps first:
  pip install -r requirements-training.txt

  # Run on Apple Silicon Mac:
  python scripts/train-resume-lm.py

  # With custom args:
  python scripts/train-resume-lm.py \
    --model mlx-community/Qwen2.5-7B-Instruct-4bit \
    --data-dir training-data \
    --output-dir resume-lora \
    --epochs 5 \
    --lora-rank 16

  # Use 8-bit model (better quality, uses ~10GB more RAM):
  python scripts/train-resume-lm.py \
    --model mlx-community/Qwen2.5-7B-Instruct-8bit

Prerequisites:
  - Apple Silicon Mac (M1/M2/M3/M4)
  - macOS 13.5+
  - pip install -r requirements-training.txt
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune Qwen 2.5 7B for resume generation (MLX)")
    parser.add_argument("--model", type=str, default="mlx-community/Qwen2.5-7B-Instruct-4bit",
                        help="MLX model from HuggingFace (use mlx-community/ for pre-converted)")
    parser.add_argument("--data-dir", type=str, default="training-data",
                        help="Directory containing train.jsonl and val.jsonl")
    parser.add_argument("--output-dir", type=str, default="resume-lora",
                        help="Output directory for LoRA adapter weights")
    parser.add_argument("--epochs", type=int, default=5,
                        help="Number of training epochs (5 recommended for ~40 full examples)")
    parser.add_argument("--lr", type=float, default=1e-5,
                        help="Learning rate (1e-5 recommended for MLX LoRA)")
    parser.add_argument("--lora-rank", type=int, default=16,
                        help="LoRA rank (16 good for small datasets, 8 for less overfitting)")
    parser.add_argument("--lora-layers", type=int, default=16,
                        help="Number of transformer layers to apply LoRA to")
    parser.add_argument("--batch-size", type=int, default=1,
                        help="Training batch size (1-2 for 36GB with 7B model)")
    parser.add_argument("--grad-accum", type=int, default=4,
                        help="Gradient accumulation steps (effective batch = batch_size * grad_accum)")
    parser.add_argument("--max-seq-length", type=int, default=4096,
                        help="Maximum sequence length (4096 fits full resumes)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed")
    parser.add_argument("--resume-from", type=str, default=None,
                        help="Resume training from adapter checkpoint")
    parser.add_argument("--val-batches", type=int, default=10,
                        help="Number of validation batches per eval")
    parser.add_argument("--steps-per-eval", type=int, default=50,
                        help="Run validation every N steps")
    parser.add_argument("--steps-per-save", type=int, default=50,
                        help="Save checkpoint every N steps")
    return parser.parse_args()


# ── Data Formatting ─────────────────────────────────────────────────────────

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
    "You may rephrase, reorder, and optimize keywords — but all facts must come "
    "from the provided context."
)


def convert_jsonl_to_chat_format(input_path: str, output_path: str):
    """Convert instruction/input/output JSONL to chat-format JSONL for mlx-lm.

    MLX-lm expects chat format:
    {"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}
    """
    examples = []
    with open(input_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            ex = json.loads(line)

            user_content = ex["instruction"]
            if ex.get("input"):
                user_content += f"\n\n{ex['input']}"

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": ex["output"]},
            ]
            examples.append({"messages": messages})

    with open(output_path, "w", encoding="utf-8") as f:
        for ex in examples:
            f.write(json.dumps(ex) + "\n")

    return len(examples)


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    # Validate data directory
    train_path = os.path.join(args.data_dir, "train.jsonl")
    val_path = os.path.join(args.data_dir, "val.jsonl")

    if not os.path.exists(train_path):
        print(f"Error: Training data not found at {train_path}")
        print("Run `npx tsx scripts/prepare-training-data.ts` first.")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  Resume LM Fine-Tuning (MLX LoRA on Apple Silicon)")
    print(f"{'='*60}")
    print(f"  Model:          {args.model}")
    print(f"  LoRA rank:      {args.lora_rank}")
    print(f"  LoRA layers:    {args.lora_layers}")
    print(f"  Epochs:         {args.epochs}")
    print(f"  LR:             {args.lr}")
    print(f"  Batch size:     {args.batch_size}")
    print(f"  Grad accum:     {args.grad_accum}")
    print(f"  Effective batch: {args.batch_size * args.grad_accum}")
    print(f"  Max seq length: {args.max_seq_length}")
    print(f"{'='*60}\n")

    # ── Convert data to chat format ─────────────────────────────────────────

    chat_dir = os.path.join(args.data_dir, "chat-format")
    os.makedirs(chat_dir, exist_ok=True)

    chat_train = os.path.join(chat_dir, "train.jsonl")
    chat_val = os.path.join(chat_dir, "valid.jsonl")  # mlx-lm expects "valid.jsonl"

    print("Converting training data to chat format...")
    train_count = convert_jsonl_to_chat_format(train_path, chat_train)
    val_count = 0
    if os.path.exists(val_path):
        val_count = convert_jsonl_to_chat_format(val_path, chat_val)
    print(f"  Train: {train_count} examples → {chat_train}")
    print(f"  Val:   {val_count} examples → {chat_val}\n")

    # ── Calculate training iterations ───────────────────────────────────────

    iters_per_epoch = max(1, train_count // (args.batch_size * args.grad_accum))
    total_iters = iters_per_epoch * args.epochs

    print(f"Training plan:")
    print(f"  Iterations per epoch: {iters_per_epoch}")
    print(f"  Total iterations:     {total_iters}")
    print(f"  Eval every:           {args.steps_per_eval} steps")
    print(f"  Save every:           {args.steps_per_save} steps\n")

    # ── Build LoRA config ───────────────────────────────────────────────────

    lora_config = {
        "model": args.model,
        "train": True,
        "data": chat_dir,
        "fine_tune_type": "lora",
        "lora_parameters": {
            "rank": args.lora_rank,
            "alpha": args.lora_rank * 2,  # alpha = 2 * rank is a good default
            "dropout": 0.05,
            "scale": (args.lora_rank * 2) / args.lora_rank,  # alpha / rank
        },
        "num_layers": args.lora_layers,
        "iters": total_iters,
        "learning_rate": args.lr,
        "batch_size": args.batch_size,
        "grad_checkpoint": True,  # Save memory on large sequences
        "max_seq_length": args.max_seq_length,
        "steps_per_eval": args.steps_per_eval,
        "val_batches": args.val_batches,
        "steps_per_report": 1,
        "adapter_path": args.output_dir,
        "save_every": args.steps_per_save,
        "seed": args.seed,
    }

    # Save config for reproducibility
    os.makedirs(args.output_dir, exist_ok=True)
    config_path = os.path.join(args.output_dir, "training_config.json")
    with open(config_path, "w") as f:
        json.dump(lora_config, f, indent=2)
    print(f"Training config saved to {config_path}")

    # Write YAML config for mlx_lm.lora (LoRA params must go via config file)
    import yaml
    yaml_config = {
        "model": args.model,
        "data": chat_dir,
        "train": True,
        "fine_tune_type": "lora",
        "iters": total_iters,
        "learning_rate": args.lr,
        "batch_size": args.batch_size,
        "num_layers": args.lora_layers,
        "max_seq_length": args.max_seq_length,
        "steps_per_eval": args.steps_per_eval,
        "val_batches": args.val_batches,
        "steps_per_report": 1,
        "adapter_path": args.output_dir,
        "save_every": args.steps_per_save,
        "seed": args.seed,
        "grad_checkpoint": True,
        "lora_parameters": {
            "rank": args.lora_rank,
            "alpha": args.lora_rank * 2,
            "dropout": 0.05,
            "scale": float((args.lora_rank * 2) / args.lora_rank),
        },
    }

    if args.resume_from:
        yaml_config["resume_adapter_file"] = os.path.join(args.resume_from, "adapters.safetensors")

    yaml_path = os.path.join(args.output_dir, "lora_config.yaml")
    with open(yaml_path, "w") as f:
        yaml.dump(yaml_config, f, default_flow_style=False)
    print(f"MLX LoRA config saved to {yaml_path}\n")

    # ── Run MLX LoRA training via CLI ─────────────────────────────────────────

    print("Starting MLX LoRA fine-tuning...\n")
    start_time = time.time()

    import subprocess

    cmd = [
        sys.executable, "-m", "mlx_lm.lora",
        "--config", yaml_path,
    ]

    print(f"Running: {' '.join(cmd)}\n")
    # Stream output in real-time so progress is visible
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in process.stdout:
        print(line, end="")
    process.wait()
    if process.returncode != 0:
        print(f"\nTraining failed with exit code {process.returncode}")
        sys.exit(1)

    elapsed = time.time() - start_time
    minutes = elapsed / 60

    print(f"\n{'='*60}")
    print(f"  Training Complete!")
    print(f"{'='*60}")
    print(f"  Time:     {minutes:.1f} minutes")
    print(f"  Adapter:  {args.output_dir}/adapters.safetensors")
    print(f"  Config:   {config_path}")
    print(f"{'='*60}")
    print(f"\nNext step — merge adapter into base model:")
    print(f"  python scripts/merge-lora.py --model {args.model} --adapter {args.output_dir}")
    print(f"\nOr test directly with adapter (no merge needed):")
    print(f"  python -m mlx_lm.generate --model {args.model} --adapter-path {args.output_dir} "
          f"--prompt 'Generate a resume for...'")


if __name__ == "__main__":
    main()
