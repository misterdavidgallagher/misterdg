import json
import sys

def extract_words(whisper_json_path):
    with open(whisper_json_path, 'r') as f:
        data = json.load(f)
    
    words = []
    for segment in data['segments']:
        if 'words' in segment:
            for word_data in segment['words']:
                words.append({
                    'word': word_data['word'].strip(),
                    'start': word_data['start'],
                    'end': word_data['end'],
                    'confidence': word_data.get('probability', 1.0)
                })
    
    return words

def save_clean_timing(words, output_path):
    with open(output_path, 'w') as f:
        json.dump(words, f, indent=2)

if __name__ == "__main__":
    input_file = sys.argv[1]  # whisper output json
    output_file = sys.argv[2]  # clean timing json
    
    words = extract_words(input_file)
    save_clean_timing(words, output_file)
    print(f"Processed {len(words)} words")