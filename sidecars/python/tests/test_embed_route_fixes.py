import os
import sys
import tempfile
import unittest
from unittest.mock import patch, MagicMock

# Ensure sidecars/python directory is in sys.path
sys_path_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if sys_path_dir not in sys.path:
    sys.path.insert(0, sys_path_dir)

from embed.routes import is_embed_installed, embed_batch, EmbedBatchRequest
import embed.routes as embed_routes
from lifecycle import ModelState


class TestEmbedRouteFixes(unittest.TestCase):
    def test_pytorch_model_bin_installed(self):
        """is_embed_installed should return True when pytorch_model.bin and config.json exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("embed.routes.get_embed_model_path", return_value=tmpdir):
                with open(os.path.join(tmpdir, "config.json"), "w") as f:
                    f.write("{}")
                with open(os.path.join(tmpdir, "pytorch_model.bin"), "w") as f:
                    f.write("weights")
                self.assertTrue(is_embed_installed())

    def test_safetensors_installed(self):
        """is_embed_installed should return True when model.safetensors and config.json exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("embed.routes.get_embed_model_path", return_value=tmpdir):
                with open(os.path.join(tmpdir, "config.json"), "w") as f:
                    f.write("{}")
                with open(os.path.join(tmpdir, "model.safetensors"), "w") as f:
                    f.write("weights")
                self.assertTrue(is_embed_installed())

    def test_missing_weights_returns_false(self):
        """is_embed_installed should return False when no weight files exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("embed.routes.get_embed_model_path", return_value=tmpdir):
                with open(os.path.join(tmpdir, "config.json"), "w") as f:
                    f.write("{}")
                self.assertFalse(is_embed_installed())

    def test_503_when_not_in_memory_and_not_installed(self):
        """embed_batch should return 503 MODELS_NOT_INSTALLED only when not in memory AND not installed."""
        embed_routes._embedder = None
        with patch("embed.routes.is_embed_installed", return_value=False):
            with patch.object(embed_routes.lifecycle_manager, "get_state", return_value=ModelState.UNLOADED.value):
                res = embed_batch(EmbedBatchRequest(texts=["test sentence"]))
                self.assertEqual(res.status_code, 503)
                import json
                body = json.loads(res.body.decode("utf-8"))
                self.assertEqual(body.get("code"), "MODELS_NOT_INSTALLED")

    def test_no_503_when_in_memory_even_if_not_installed(self):
        """embed_batch should proceed when model is already loaded in memory (_embedder is not None)."""
        mock_model = MagicMock()
        mock_model.encode.return_value = [[0.1, 0.2, 0.3]]
        embed_routes._embedder = mock_model

        with patch("embed.routes.is_embed_installed", return_value=False):
            with patch.object(embed_routes.lifecycle_manager, "get_state", return_value=ModelState.LOADED.value):
                with patch.object(embed_routes.lifecycle_manager, "acquire") as mock_acquire:
                    # Context manager returns mock_model
                    mock_acquire.return_value.__enter__.return_value = mock_model
                    res = embed_batch(EmbedBatchRequest(texts=["test sentence"]))
                    self.assertIsInstance(res, dict)
                    self.assertEqual(res.get("status"), "success")
                    self.assertEqual(res.get("embeddings"), [[0.1, 0.2, 0.3]])

        # Cleanup
        embed_routes._embedder = None

    def test_no_503_and_real_acquire_when_in_memory_and_lifecycle_unloaded(self):
        """embed_batch should acquire and return mock_model via _load_embedder when lifecycle is UNLOADED."""
        mock_model = MagicMock()
        mock_model.encode.return_value = [[0.4, 0.5, 0.6]]
        embed_routes._embedder = mock_model
        embed_routes.lifecycle_manager._models["embed"].state = ModelState.UNLOADED
        embed_routes.lifecycle_manager._models["embed"].instance = None

        with patch("embed.routes.is_embed_installed", return_value=False):
            res = embed_batch(EmbedBatchRequest(texts=["test sentence"]))
            self.assertIsInstance(res, dict)
            self.assertEqual(res.get("status"), "success")
            self.assertEqual(res.get("embeddings"), [[0.4, 0.5, 0.6]])

        # Cleanup
        embed_routes._embedder = None
        embed_routes.lifecycle_manager._models["embed"].state = ModelState.UNLOADED
        embed_routes.lifecycle_manager._models["embed"].instance = None


if __name__ == "__main__":
    unittest.main()
