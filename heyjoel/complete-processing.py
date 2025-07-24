import subprocess
import json
import os
import sys

def process_audio_file(audio_path, output_dir="./processed"):
    """Complete pipeline from audio to clean timing JSON"""
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    base_name = os.path.splitext(os.path.basename(audio_path))[0]
    
    # Step 1: Run Whisper
    whisper_cmd = [
        "whisper", audio_path,
        "--model", "medium",
        "--word_timestamps", "True",
        "--output_format", "json",
        "--language", "en",
        "--output_dir", output_dir
    ]
    
    print("Running Whisper transcription...")
    subprocess.run(whisper_cmd, check=True)
    
    # Step 2: Process the output
    whisper_json = os.path.join(output_dir, f"{base_name}.json")
    clean_json = os.path.join(output_dir, f"{base_name}-timing.json")
    
    # Extract and clean words (using the function from above)
    words = extract_words(whisper_json)
    save_clean_timing(words, clean_json)
    
    print(f"✓ Processed {len(words)} words")
    print(f"✓ Clean timing saved to: {clean_json}")
    
    return clean_json

if __name__ == "__main__":
    audio_file = sys.argv[1]
    result = process_audio_file(audio_file)