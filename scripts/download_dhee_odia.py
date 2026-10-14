# scripts/download_dhee_odia.py
import os
import sys
import urllib.request
import time

MODEL_REPO = "dheeyantra/dhee-nxtgen-qwen3-odia-v2"
BASE_URL = f"https://huggingface.co/{MODEL_REPO}/resolve/main"

TARGET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "dhee-odia")
os.makedirs(TARGET_DIR, exist_ok=True)

FILES = [
    "config.json",
    "generation_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
    "merges.txt",
    "special_tokens_map.json",
    "added_tokens.json",
    "chat_template.jinja",
    "model.safetensors"
]

def download_file(filename):
    target_path = os.path.join(TARGET_DIR, filename)
    url = f"{BASE_URL}/{filename}"
    expected_size = 3441185296 if filename == "model.safetensors" else None
    
    # Check if already fully downloaded
    if os.path.exists(target_path):
        current_size = os.path.getsize(target_path)
        if expected_size and current_size == expected_size:
            print(f"  [cached] {filename} (complete, {current_size:,} bytes)")
            return
        elif not expected_size and current_size > 0:
            print(f"  [cached] {filename} ({current_size:,} bytes)")
            return
    else:
        current_size = 0

    print(f"  Downloading {filename} (from {current_size / (1024*1024):.1f} MB)...")
    start_time = time.time()
    
    while True:
        if expected_size and current_size >= expected_size:
            break
            
        headers = {'User-Agent': 'StudyBuddy-Model-Downloader/1.0'}
        if current_size > 0:
            headers['Range'] = f"bytes={current_size}-"
            
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as response, open(target_path, 'ab' if current_size > 0 else 'wb') as out_file:
                content_range = response.info().get('Content-Range', '')
                if content_range and '/' in content_range:
                    total_size = int(content_range.split('/')[-1])
                else:
                    total_size = int(response.info().get('Content-Length', 0)) + current_size
                    
                chunk_size = 1024 * 1024 # 1MB
                last_print = time.time()
                
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    out_file.write(chunk)
                    current_size += len(chunk)
                    
                    now = time.time()
                    if now - last_print > 3:
                        elapsed = now - start_time
                        speed = (current_size / (1024 * 1024)) / elapsed if elapsed > 0 else 0
                        pct = (current_size / total_size * 100) if total_size > 0 else 0
                        print(f"    {filename}: {pct:.1f}% ({current_size / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB) @ {speed:.2f} MB/s", flush=True)
                        last_print = now
                        
            if expected_size:
                if current_size >= expected_size:
                    break
                else:
                    print(f"    [reconnecting] Download paused at {current_size / (1024*1024):.1f} MB, resuming...")
                    time.sleep(2)
            else:
                break
        except Exception as e:
            print(f"    [retry] Network interruption: {e}. Resuming in 3s...", flush=True)
            time.sleep(3)

    elapsed = time.time() - start_time
    print(f"  [OK] Finished {filename} ({current_size:,} bytes in {elapsed:.1f}s)")

def main():
    print("=" * 60)
    print(f"Downloading Dhee-NxtGen-Qwen3-Odia-v2 from Hugging Face")
    print(f"Target: {TARGET_DIR}")
    print("=" * 60)
    
    for f in FILES:
        download_file(f)
        
    print("\nAll model files downloaded successfully!")

if __name__ == "__main__":
    main()
