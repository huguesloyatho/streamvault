#!/usr/bin/env python3
"""
Fast audio transcription using faster-whisper.
Usage: python3 transcribe.py <audio_file> [language]
Output: JSON with transcription result
"""

import sys
import json
import os

def transcribe(audio_path: str, language: str = "en") -> dict:
    """Transcribe audio file using faster-whisper."""
    try:
        from faster_whisper import WhisperModel

        # Use base model for better accuracy (tiny misses too much speech)
        # Options: tiny, base, small, medium, large
        model_size = os.environ.get("WHISPER_MODEL", "base")

        # Use CPU by default, GPU if available
        device = "cpu"
        compute_type = "int8"

        # Check for Metal/MPS on Mac
        try:
            import torch
            if torch.backends.mps.is_available():
                device = "cpu"  # faster-whisper doesn't support MPS directly
                compute_type = "int8"
        except:
            pass

        model = WhisperModel(model_size, device=device, compute_type=compute_type)

        segments, info = model.transcribe(
            audio_path,
            language=language if language else None,
            beam_size=5,
            word_timestamps=False,
            vad_filter=True,  # Filter out silence
        )

        # Collect all segments
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        full_text = " ".join(text_parts)

        return {
            "success": True,
            "text": full_text,
            "language": info.language if info.language else language,
            "duration": info.duration,
        }

    except ImportError:
        # Fallback to openai-whisper if faster-whisper not available
        try:
            import whisper

            model = whisper.load_model("base")
            result = model.transcribe(audio_path, language=language)

            return {
                "success": True,
                "text": result["text"].strip(),
                "language": result.get("language", language),
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Whisper not available: {str(e)}",
                "text": "",
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "text": "",
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: transcribe.py <audio_file> [language]"}))
        sys.exit(1)

    audio_file = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "en"

    if not os.path.exists(audio_file):
        print(json.dumps({"success": False, "error": f"File not found: {audio_file}"}))
        sys.exit(1)

    result = transcribe(audio_file, language)
    print(json.dumps(result))
