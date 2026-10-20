"""
sidecars/python/tts/synthesize.py

Synthesis engine for Kokoro-82M TTS.
Provides sentence-level 24kHz 16-bit mono PCM WAV audio generation.
"""

import os
import io
import re
import wave
import unicodedata
import sys
from typing import Optional

def _resolve_kokoro_dir() -> str:
    if os.environ.get('OMNITOME_KOKORO_DIR'):
        return os.environ['OMNITOME_KOKORO_DIR']
    model_dir = os.environ.get('OMNITOME_MODEL_DIR')
    if model_dir:
        candidate = os.path.join(model_dir, 'kokoro')
        if os.path.exists(candidate) or not os.path.exists(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models', 'kokoro'))):
            return candidate
    if sys.platform == 'win32':
        local_app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
        candidate = os.path.join(local_app_data, "Omnitome", "models", "kokoro")
        if os.path.exists(candidate):
            return candidate
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models', 'kokoro'))


MODEL_DIR = _resolve_kokoro_dir()

VOICE_WHITELIST = ['af_heart', 'am_adam', 'bf_alice', 'bm_george']


class ModelNotInstalledError(Exception):
    """Raised when Kokoro model weights or package are not found."""
    pass


class UnsupportedLanguageError(Exception):
    """Raised when input text contains predominantly non-Latin/non-English scripts."""
    pass


class InputTooLongError(Exception):
    """Raised when input text exceeds 1,000 characters."""
    pass


_engine = None


def _resolve_voice_path(voice_name: str) -> Optional[str]:
    """
    Finds the absolute path to a Kokoro voice file (.pt) across local locations,
    preventing any unexpected calls to Hugging Face Hub in offline mode.
    """
    if not voice_name or not isinstance(voice_name, str):
        return None

    clean_voice = voice_name.strip()
    if clean_voice.lower().endswith('.pt'):
        clean_voice = clean_voice[:-3]
    clean_voice = os.path.basename(clean_voice).lower().strip()
    filename = f"{clean_voice}.pt"

    local_app_data = os.environ.get("LOCALAPPDATA")
    candidate_dirs = [
        # 1. Kokoro model directory / voices
        os.path.join(MODEL_DIR, "voices"),
        MODEL_DIR,
    ]
    if local_app_data:
        candidate_dirs.append(os.path.join(local_app_data, "Omnitome", "models", "kokoro", "voices"))
        candidate_dirs.append(os.path.join(local_app_data, "Omnitome", "models", "kokoro"))

    candidate_dirs.extend([
        # 2. Local AppData Omnitome via expanduser
        os.path.expanduser(r"~\AppData\Local\Omnitome\models\kokoro\voices"),
        os.path.expanduser(r"~\AppData\Local\Omnitome\models\kokoro"),
        # 3. Project / repo paths
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "kokoro", "voices")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "kokoro")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "resources", "models", "kokoro", "voices")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "resources", "models", "kokoro")),
    ])

    for c_dir in candidate_dirs:
        candidate_file = os.path.join(c_dir, filename)
        if os.path.isfile(candidate_file):
            return candidate_file

    # 4. Search in HuggingFace cache snapshots (offline local cache)
    hf_homes = [
        os.environ.get("HF_HOME"),
        os.path.expanduser("~/.cache/huggingface"),
        os.path.expanduser(r"~\AppData\Local\huggingface"),
    ]
    for hf_home in hf_homes:
        if not hf_home or not os.path.isdir(hf_home):
            continue
        snapshots_dir = os.path.join(hf_home, "hub", "models--hexgrad--Kokoro-82M", "snapshots")
        if os.path.isdir(snapshots_dir):
            try:
                for snap in os.listdir(snapshots_dir):
                    v_file = os.path.join(snapshots_dir, snap, "voices", filename)
                    if os.path.isfile(v_file):
                        # Copy to MODEL_DIR/voices so subsequent lookups are local and immediate
                        try:
                            target_dir = os.path.join(MODEL_DIR, "voices")
                            os.makedirs(target_dir, exist_ok=True)
                            target_file = os.path.join(target_dir, filename)
                            if not os.path.exists(target_file):
                                import shutil
                                shutil.copyfile(v_file, target_file)
                                return target_file
                        except Exception:
                            pass
                        return v_file
            except Exception:
                pass

    return None


def get_model_path() -> str:
    return os.path.join(MODEL_DIR, 'kokoro-v1_0.pth')


def is_model_installed() -> bool:
    return os.path.exists(get_model_path())


def load_engine():
    """
    Loads Kokoro pipeline. Uses lazy import so the sidecar can boot
    even if the kokoro package or model weights are absent.
    """
    global _engine
    if _engine is not None:
        return _engine

    model_path = get_model_path()
    if not os.path.exists(model_path):
        raise ModelNotInstalledError(f"Kokoro weights not found at {model_path}")

    try:
        import torch
        from kokoro import KPipeline, KModel
    except ImportError as e:
        raise ModelNotInstalledError(f"Kokoro library not installed: {e}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[TTS] Loading Kokoro pipeline from {model_path} (device={device})...")
    try:
        model_dir = os.path.dirname(model_path)
        config_path = os.path.join(model_dir, 'config.json')

        if not os.path.exists(config_path):
            candidate_fallback_paths = [
                os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models', 'kokoro', 'config.json')),
                os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend', 'config', 'kokoro-config.json')),
                os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'resources', 'models', 'kokoro', 'config.json')),
            ]
            for candidate in candidate_fallback_paths:
                if os.path.exists(candidate):
                    try:
                        import shutil
                        os.makedirs(model_dir, exist_ok=True)
                        shutil.copyfile(candidate, config_path)
                    except Exception:
                        config_path = candidate
                    break

        if os.path.exists(config_path):
            print(f"[TTS] Found local Kokoro config at {config_path}")
            try:
                kmodel = KModel(repo_id='hexgrad/Kokoro-82M', config=config_path, model=model_path).to(device).eval()
                _engine = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M', model=kmodel, device=device)
            except TypeError:
                try:
                    kmodel = KModel(config=config_path, model=model_path).to(device).eval()
                    _engine = KPipeline(lang_code='a', model=kmodel, device=device)
                except TypeError:
                    _engine = KPipeline(lang_code='a', model=model_path, config=config_path, device=device)
        else:
            if os.environ.get("HF_HUB_OFFLINE") == "1":
                raise ModelNotInstalledError(
                    f"Kokoro config.json was not found in {model_dir} and HF_HUB_OFFLINE=1 prevents downloading it from HuggingFace."
                )
            try:
                kmodel = KModel(repo_id='hexgrad/Kokoro-82M', model=model_path).to(device).eval()
                _engine = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M', model=kmodel, device=device)
            except Exception:
                _engine = KPipeline(lang_code='a', model=model_path, device=device)

        # Attach offline voice resolver to pipeline so it never invokes hf_hub_download
        def _custom_load_single_voice(voice: str):
            if hasattr(_engine, 'voices') and voice in _engine.voices:
                return _engine.voices[voice]
            clean_name = str(voice or '').strip().lower()
            if clean_name.endswith('.pt'):
                clean_name = clean_name[:-3]
            clean_name = os.path.basename(clean_name).strip().lower()
            if hasattr(_engine, 'voices') and clean_name in _engine.voices:
                return _engine.voices[clean_name]

            v_path = _resolve_voice_path(clean_name)
            if v_path and os.path.isfile(v_path):
                import torch
                pack = torch.load(v_path, weights_only=True)
                if hasattr(_engine, 'voices'):
                    _engine.voices[voice] = pack
                    _engine.voices[clean_name] = pack
                return pack

            raise ModelNotInstalledError(
                f"Kokoro voice '{clean_name}' not found locally. Please ensure voice weights are installed in {os.path.join(MODEL_DIR, 'voices')}."
            )

        _engine.load_single_voice = _custom_load_single_voice

        # Pre-load all whitelisted voices if available
        for v in VOICE_WHITELIST:
            try:
                _custom_load_single_voice(v)
            except Exception as e:
                print(f"[TTS] Pre-loading voice {v} notice: {e}")

        print("[TTS] Kokoro pipeline loaded successfully.")
        return _engine
    except Exception as e:
        print(f"[TTS Error] Failed to load Kokoro pipeline: {e}", file=sys.stderr)
        raise


def unload_engine(model=None):
    """
    Unloads the engine and releases RAM / CUDA VRAM.
    """
    global _engine
    print("[TTS] Unloading Kokoro engine...")
    _engine = None
    del model
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    import gc
    gc.collect()


def is_predominantly_non_latin(text: str) -> bool:
    """
    Checks if text is predominantly composed of non-Latin characters.
    Ignores whitespace, common digits, and punctuation.
    """
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False

    latin_count = sum(
        1 for c in letters
        if ord(c) < 0x250 or 'LATIN' in unicodedata.name(c, '')
    )
    non_latin_count = len(letters) - latin_count
    return non_latin_count > latin_count


def sanitize_text(text: str) -> str:
    """
    Cleans citation tags, collapses whitespace, and NFC normalizes.
    """
    if not text:
        return ""
    # Strip citation brackets e.g. [Source 1], (Sources 1-3)
    cleaned = re.sub(r'\s*\[Source \d+\]', '', text)
    cleaned = re.sub(r'\s*\(Sources? \d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*\)', '', cleaned)
    # Normalize unicode to NFC
    cleaned = unicodedata.normalize('NFC', cleaned)
    # Collapse whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def estimate_duration_ms(wav_bytes: bytes) -> int:
    """
    Calculates audio duration in milliseconds from 24kHz 16-bit mono WAV PCM data.
    44-byte standard RIFF header is excluded.
    """
    pcm_bytes = max(0, len(wav_bytes) - 44)
    # 24,000 samples/sec * 2 bytes/sample (16-bit mono) = 48,000 bytes/sec
    return int(round((pcm_bytes / (24000 * 2)) * 1000))


def synthesize_sentence(text: str, voice: str = 'af_heart', speed: float = 1.0) -> bytes:
    """
    Synthesizes a single sentence into 24kHz 16-bit mono WAV bytes.
    """
    if not text or not isinstance(text, str) or not text.strip():
        raise ValueError("Text cannot be empty")

    cleaned = sanitize_text(text)
    if not cleaned:
        # Generate 250ms silence WAV so citation-only sentences do not crash playback
        sample_rate = 24000
        silence_samples = int(sample_rate * 0.25)
        raw_pcm_bytes = b"\x00\x00" * silence_samples
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(raw_pcm_bytes)
        return buf.getvalue()

    if len(cleaned) > 1000:
        raise InputTooLongError(
            f"Input text length ({len(cleaned)}) exceeds maximum allowed limit of 1000 characters."
        )

    if is_predominantly_non_latin(cleaned):
        raise UnsupportedLanguageError(
            "Predominantly non-English/non-Latin scripts are not supported in v1.0."
        )

    norm_voice = (voice or 'af_heart').lower().strip()
    if norm_voice not in VOICE_WHITELIST:
        norm_voice = 'af_heart'

    clamped_speed = max(0.5, min(2.0, float(speed if speed is not None else 1.0)))

    # Ensure engine is loaded
    engine = load_engine()

    try:
        import numpy as np
    except ImportError:
        np = None

    # Call Kokoro pipeline
    # Kokoro generator yields tuples: (graphemes, phonemes, audio)
    audio_chunks = []
    for _, _, audio in engine(cleaned, voice=norm_voice, speed=clamped_speed):
        if audio is not None:
            if hasattr(audio, 'numpy'):
                audio = audio.numpy()
            audio_chunks.append(audio)

    if not audio_chunks:
        raise RuntimeError("Kokoro engine produced no audio output.")

    if np is not None:
        full_audio = np.concatenate(audio_chunks)
        # Convert float32 [-1.0, 1.0] to int16 PCM [-32768, 32767]
        pcm_int16 = (full_audio * 32767).clip(-32768, 32767).astype(np.int16)
        raw_pcm_bytes = pcm_int16.tobytes()
    else:
        import array
        raw_pcm_bytes = b"".join(
            array.array('h', [int(max(-1.0, min(1.0, float(x))) * 32767) for x in chunk]).tobytes()
            for chunk in audio_chunks
        )

    # Encode to 24kHz 16-bit mono WAV
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav_file:
        wav_file.setnchannels(1)      # Mono
        wav_file.setsampwidth(2)      # 16-bit
        wav_file.setframerate(24000)  # 24kHz
        wav_file.writeframes(raw_pcm_bytes)

    return buf.getvalue()

