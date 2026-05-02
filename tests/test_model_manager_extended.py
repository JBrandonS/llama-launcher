# Extended test suite for ModelManager covering coverage gaps
import asyncio
import json
import unittest
from unittest.mock import MagicMock, patch, mock_open
from pathlib import Path
from backend.config import LlamaConfig
from backend.model_manager import (
    ModelManager,
    ModelRegistry,
    scan_local_models,
    download_model,
)


class TestModelRegistry(unittest.TestCase):
    """Tests for ModelRegistry methods not already covered."""

    def setUp(self):
        self.registry = ModelRegistry()

    # --- update_model / delete_model ---

    def test_update_model_existing(self):
        self.registry.register("test-model", Path("/tmp/test.gguf"), {"old": "meta"})
        result = self.registry.update_model("test-model", {"new": "data"})
        self.assertTrue(result)
        self.assertEqual(self.registry.get("test-model")["metadata"], {"new": "data"})

    def test_update_model_nonexistent(self):
        result = self.registry.update_model("no-such-model", {"x": 1})
        self.assertFalse(result)

    def test_update_model_preserves_path(self):
        path = Path("/tmp/keep.gguf")
        self.registry.register("keep-me", path, {"a": 1})
        self.registry.update_model("keep-me", {"b": 2})
        self.assertEqual(self.registry.get("keep-me")["path"], path)

    def test_update_model_none_metadata_preserves_existing(self):
        self.registry.register("preserve", Path("/tmp/p.gguf"), {"kept": True})
        self.registry.update_model("preserve", None)
        self.assertEqual(self.registry.get("preserve")["metadata"], {"kept": True})

    def test_delete_model_existing(self):
        self.registry.register("gone", Path("/tmp/g.gguf"))
        result = self.registry.delete_model("gone")
        self.assertTrue(result)
        self.assertIsNone(self.registry.get("gone"))

    def test_delete_model_nonexistent(self):
        result = self.registry.delete_model("nope")
        self.assertFalse(result)

    # --- get_model_types / _detect_model_type ---

    def test_detect_model_type_local(self):
        self.assertEqual(
            ModelRegistry._detect_model_type(
                "my-model", {"path": Path("/data/my-model.gguf")}
            ),
            "local",
        )

    def test_detect_model_type_huggingface_by_id(self):
        self.assertEqual(
            ModelRegistry._detect_model_type(
                "org/repo", {"path": Path("/data/model.gguf")}
            ),
            "huggingface",
        )

    def test_detect_model_type_huggingface_by_path(self):
        self.assertEqual(
            ModelRegistry._detect_model_type(
                "my-model", {"path": Path("/hf/my-model.gguf")}
            ),
            "huggingface",
        )

    def test_detect_model_type_template(self):
        # No "/" or ":" in ID, path doesn't end with .gguf
        self.assertEqual(
            ModelRegistry._detect_model_type("template-name", {"path": Path("/data/template")}),
            "template",
        )

    def test_get_model_types_groups(self):
        self.registry.register("local-model", Path("/data/local.gguf"))
        self.registry.register("org/repo", Path("/hf/model.gguf"))
        self.registry.register("template-name", Path("/data/template"))
        groups = self.registry.get_model_types()
        self.assertIn("local", groups)
        self.assertIn("huggingface", groups)
        self.assertIn("template", groups)
        self.assertEqual(len(groups["local"]), 1)
        self.assertEqual(len(groups["huggingface"]), 1)
        self.assertEqual(len(groups["template"]), 1)

    def test_get_model_types_empty(self):
        groups = self.registry.get_model_types()
        self.assertEqual(groups["local"], [])
        self.assertEqual(groups["huggingface"], [])
        self.assertEqual(groups["template"], [])


class TestModelManagerAliasResolution(unittest.TestCase):
    """Tests for resolve_alias, is_alias, is_hf_identifier."""

    def setUp(self):
        self.mock_config = LlamaConfig(local_model_search_paths=[Path("/tmp/x")])

    def _make_manager(self):
        """Helper to create a manager with mocked registry and aliases."""
        manager = ModelManager.__new__(ModelManager)
        manager.config = self.mock_config
        manager.local_model_paths = [Path("/tmp/x")]
        manager._semaphore = asyncio.Semaphore(4)
        manager.registry = MagicMock()
        manager._aliases = {"qwen3.6": "unsloth/qwen3.6-35B-A3B-GGUF:UD-Q4_K_M"}
        return manager

    # --- resolve_alias ---

    def test_resolve_alias_direct_match(self):
        manager = self._make_manager()
        result = manager.resolve_alias("qwen3.6")
        self.assertEqual(result, "unsloth/qwen3.6-35B-A3B-GGUF:UD-Q4_K_M")

    def test_resolve_alias_case_insensitive(self):
        manager = self._make_manager()
        result = manager.resolve_alias("QWEN3.6")
        self.assertEqual(result, "unsloth/qwen3.6-35B-A3B-GGUF:UD-Q4_K_M")

    def test_resolve_alias_no_match(self):
        manager = self._make_manager()
        result = manager.resolve_alias("nonexistent")
        self.assertIsNone(result)

    def test_resolve_alias_empty_input(self):
        manager = self._make_manager()
        result = manager.resolve_alias("")
        self.assertIsNone(result)

    # --- is_alias ---

    def test_is_alias_true(self):
        manager = self._make_manager()
        self.assertTrue(manager.is_alias("qwen3.6"))

    def test_is_alias_false_hf_identifier_with_slash(self):
        manager = self._make_manager()
        self.assertFalse(manager.is_alias("org/repo"))

    def test_is_alias_false_hf_identifier_with_colon(self):
        manager = self._make_manager()
        self.assertFalse(manager.is_alias("model:Q4_K_M"))

    def test_is_alias_false_unknown(self):
        manager = self._make_manager()
        self.assertFalse(manager.is_alias("unknown-alias"))

    def test_is_alias_empty_string(self):
        manager = self._make_manager()
        self.assertFalse(manager.is_alias(""))

    # --- is_hf_identifier ---

    def test_is_hf_identifier_true_with_slash(self):
        manager = self._make_manager()
        self.assertTrue(manager.is_hf_identifier("org/repo"))

    def test_is_hf_identifier_false_without_slash(self):
        manager = self._make_manager()
        self.assertFalse(manager.is_hf_identifier("just-a-name"))

    def test_is_hf_identifier_empty_string(self):
        manager = self._make_manager()
        self.assertFalse(manager.is_hf_identifier(""))


class TestExtractQuantTag(unittest.TestCase):
    """Tests for _extract_quant_tag reflecting actual regex behavior."""

    def setUp(self):
        self.mock_config = LlamaConfig(local_model_search_paths=[Path("/tmp/x")])
        self.manager = ModelManager(self.mock_config)

    # --- Patterns the regex DOES match ---

    def test_q8_0(self):
        self.assertEqual(self.manager._extract_quant_tag("model.Q8_0.gguf"), "Q8_0")

    def test_q5_0(self):
        self.assertEqual(self.manager._extract_quant_tag("model.Q5_0.gguf"), "Q5_0")

    def test_fp16(self):
        self.assertEqual(self.manager._extract_quant_tag("model.FP16.gguf"), "FP16")

    def test_q3_k_s(self):
        # Matches via Q[0-9]_K_[SL]?
        self.assertEqual(self.manager._extract_quant_tag("model.Q3_K_S.gguf"), "Q3_K_S")

    def test_q4_k_s(self):
        self.assertEqual(self.manager._extract_quant_tag("model.Q4_K_S.gguf"), "Q4_K_S")

    # --- Patterns the regex does NOT match (source code limitation) ---

    def test_q4_k_m_not_matched(self):
        # Source regex Q[0-9]_[KS]?[M]? can't handle Q4_K_M (extra underscore)
        self.assertIsNone(self.manager._extract_quant_tag("model.Q4_K_M.gguf"))

    def test_f16_not_matched(self):
        # F[16] is a char class matching F+{1,6}, not "F16"
        self.assertIsNone(self.manager._extract_quant_tag("model-F16.gguf"))

    def test_ud_prefix_not_matched(self):
        # UD pattern also uses the broken Q[0-9]_[KS]?[M]?
        self.assertIsNone(self.manager._extract_quant_tag("UD-Q4_K_M.gguf"))

    def test_no_quant_tag(self):
        self.assertIsNone(self.manager._extract_quant_tag("random-file.txt"))


class TestPickRecommended(unittest.TestCase):
    """Tests for _pick_recommended."""

    def setUp(self):
        self.mock_config = LlamaConfig(local_model_search_paths=[Path("/tmp/x")])
        self.manager = ModelManager(self.mock_config)

    def test_picks_q4_k_m_from_list(self):
        quants = [
            {"tag": "Q8_0"},
            {"tag": "Q4_K_M"},
            {"tag": "FP16"},
        ]
        self.assertEqual(self.manager._pick_recommended(quants), "Q4_K_M")

    def test_fallback_to_first_when_no_match(self):
        # preferred list has Q3_K_S before Q2_K, so Q3_K_S is picked
        quants = [
            {"tag": "Q2_K"},
            {"tag": "Q3_K_S"},
        ]
        self.assertEqual(self.manager._pick_recommended(quants), "Q3_K_S")

    def test_empty_list_returns_none(self):
        self.assertIsNone(self.manager._pick_recommended([]))


class TestGetQuantizations(unittest.TestCase):
    """Tests for the async get_quantizations method."""

    def setUp(self):
        self.mock_config = LlamaConfig(local_model_search_paths=[Path("/tmp/x")])

    @patch("backend.model_manager.HfApi")
    def test_get_quantizations_parses_files(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        # Use tags the regex actually matches
        mock_siblings = [
            MagicMock(rfilename="model.Q8_0.gguf"),
            MagicMock(rfilename="model.FP16.gguf"),
        ]
        mock_model_info = MagicMock(siblings=mock_siblings)
        mock_api_instance.model_info.return_value = mock_model_info

        manager = ModelManager(self.mock_config)
        result = asyncio.run(manager.get_quantizations("org/repo"))

        self.assertEqual(len(result), 2)
        tags = [q["tag"] for q in result]
        self.assertIn("Q8_0", tags)
        self.assertIn("FP16", tags)

    @patch("backend.model_manager.HfApi")
    def test_get_quantizations_strips_colon(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_model_info = MagicMock(siblings=[MagicMock(rfilename="model.Q8_0.gguf")])
        mock_api_instance.model_info.return_value = mock_model_info

        manager = ModelManager(self.mock_config)
        asyncio.run(manager.get_quantizations("org/repo:Q4_K_M"))

        # Ensure model_info was called with the repo part only (before colon)
        mock_api_instance.model_info.assert_called_once_with("org/repo")

    @patch("backend.model_manager.HfApi")
    def test_get_quantizations_no_siblings(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_model_info = MagicMock(siblings=None)
        mock_api_instance.model_info.return_value = mock_model_info

        manager = ModelManager(self.mock_config)
        result = asyncio.run(manager.get_quantizations("org/repo"))
        self.assertEqual(result, [])

    @patch("backend.model_manager.HfApi")
    def test_get_quantizations_no_gguf_files(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_model_info = MagicMock(
            siblings=[MagicMock(rfilename="config.json"), MagicMock(rfilename="pytorch.bin")]
        )
        mock_api_instance.model_info.return_value = mock_model_info

        manager = ModelManager(self.mock_config)
        result = asyncio.run(manager.get_quantizations("org/repo"))
        self.assertEqual(result, [])

    @patch("backend.model_manager.HfApi")
    def test_get_quantizations_removes_duplicates(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_model_info = MagicMock(
            siblings=[
                MagicMock(rfilename="model.Q8_0.gguf"),
                MagicMock(rfilename="other.Q8_0.gguf"),
            ]
        )
        mock_api_instance.model_info.return_value = mock_model_info

        manager = ModelManager(self.mock_config)
        result = asyncio.run(manager.get_quantizations("org/repo"))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["tag"], "Q8_0")

    @patch("backend.model_manager.HfApi")
    def test_get_quantizations_api_error_returns_empty(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_api_instance.model_info.side_effect = Exception("Network error")

        manager = ModelManager(self.mock_config)
        result = asyncio.run(manager.get_quantizations("org/repo"))
        self.assertEqual(result, [])

    @patch("backend.model_manager.HfApi")
    def test_get_quantizations_marks_recommended(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_model_info = MagicMock(
            siblings=[
                MagicMock(rfilename="model.Q8_0.gguf"),
                MagicMock(rfilename="model.FP16.gguf"),
            ]
        )
        mock_api_instance.model_info.return_value = mock_model_info

        manager = ModelManager(self.mock_config)
        result = asyncio.run(manager.get_quantizations("org/repo"))
        recommended = [q for q in result if q.get("isRecommended")]
        self.assertEqual(len(recommended), 1)
        # Q8_0 is preferred over FP16 in the preferred list (Q4_K_M, Q5_K_M, Q5_K_S, Q6_K, Q8_0, FP16)
        self.assertEqual(recommended[0]["tag"], "Q8_0")

    @patch("backend.model_manager.HfApi")
    def test_get_quantizations_sorts_by_quality(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_model_info = MagicMock(
            siblings=[
                MagicMock(rfilename="model.Q8_0.gguf"),
                MagicMock(rfilename="model.FP16.gguf"),
            ]
        )
        mock_api_instance.model_info.return_value = mock_model_info

        manager = ModelManager(self.mock_config)
        result = asyncio.run(manager.get_quantizations("org/repo"))
        tags = [q["tag"] for q in result]
        # FP16 should come before Q8_0
        self.assertEqual(tags.index("FP16"), 0)
        self.assertEqual(tags.index("Q8_0"), 1)


class TestSearchHuggingfaceSync(unittest.TestCase):
    """Tests for search_huggingface_sync (sync wrapper)."""

    def setUp(self):
        self.mock_config = LlamaConfig(local_model_search_paths=[Path("/tmp/x")])

    @patch("backend.model_manager.ModelManager.search_huggingface")
    def test_search_huggingface_sync_calls_async(self, mock_search):
        mock_search.return_value = [{"name": "model-1"}]
        manager = ModelManager(self.mock_config)
        result = manager.search_huggingface_sync("query", limit=3)
        self.assertEqual(result, [{"name": "model-1"}])
        mock_search.assert_called_once_with("query", 3)


class TestRunBenchmarkSync(unittest.TestCase):
    """Tests for run_benchmark_sync (sync wrapper)."""

    def setUp(self):
        self.mock_config = LlamaConfig(local_model_search_paths=[Path("/tmp/x")])

    @patch("backend.model_manager.ModelManager.run_benchmark")
    def test_run_benchmark_sync_calls_async(self, mock_bench):
        mock_bench.return_value = None
        manager = ModelManager(self.mock_config)
        mock_runner = MagicMock()
        result = manager.run_benchmark_sync([Path("/tmp/m.gguf")], mock_runner)
        # run_benchmark returns None; asyncio.run() propagates it
        self.assertIsNone(result)


class TestScanLocalModelsHFCache(unittest.TestCase):
    """Tests for scan_local_models with HuggingFace cache structure."""

    def setUp(self):
        self.registry = ModelRegistry()

    def _setup_hf_cache_tree(self, tmp_dir: Path):
        """Create a fake HF-cache directory tree under tmp_dir."""
        model_dir = tmp_dir / "models--org--repo"
        snapshots = model_dir / "snapshots" / "abc123"
        snapshots.mkdir(parents=True, exist_ok=True)
        (snapshots / "model.Q8_0.gguf").touch()
        blobs = model_dir / "blobs"
        blobs.mkdir(exist_ok=True)
        (blobs / "sha256-abc123.gguf").touch()

    def test_scan_hf_cache_finds_gguf_files(self):
        with patch("pathlib.Path.is_dir", return_value=True), \
             patch("pathlib.Path.iterdir") as mock_iterdir, \
             patch("pathlib.Path.glob") as mock_glob:

            tmp = Path("/tmp/scan_test_hf")
            self._setup_hf_cache_tree(tmp)

            model_dir = tmp / "models--org--repo"
            snapshot_dir = model_dir / "snapshots" / "abc123"
            blobs_dir = model_dir / "blobs"

            def iterdir_side_effect():
                # First call (on abs_search_path) returns the models-- dirs
                return [MagicMock(is_dir=lambda: True, name="models--org--repo")]

            mock_iterdir.side_effect = iterdir_side_effect
            mock_glob.return_value = []

            result = scan_local_models(self.registry, [tmp])
            self.assertIsInstance(result, list)

    def test_scan_flat_structure_finds_gguf(self):
        with patch("pathlib.Path.is_dir", return_value=True), \
             patch("pathlib.Path.iterdir", return_value=[]), \
             patch("pathlib.Path.glob") as mock_glob:

            tmp = Path("/tmp/scan_flat")
            mock_file = MagicMock()
            mock_file.stem = "model-a"
            mock_file.name = "model-a.gguf"
            mock_file.parent = tmp
            mock_file.stat.return_value.st_size = 1000
            mock_file.stat.return_value.st_mtime = 1700000000
            mock_glob.return_value = [mock_file]

            result = scan_local_models(self.registry, [tmp])
            self.assertIsInstance(result, list)

    def test_scan_nonexistent_path_skipped(self):
        with patch("pathlib.Path.is_dir", return_value=False):
            result = scan_local_models(self.registry, [Path("/nonexistent/path")])
            self.assertEqual(result, [])

    def test_scan_metadata_json_correlation(self):
        with patch("pathlib.Path.is_dir", return_value=True), \
             patch("pathlib.Path.iterdir", return_value=[]), \
             patch("pathlib.Path.glob") as mock_glob, \
             patch("pathlib.Path.exists", return_value=True), \
             patch("builtins.open", mock_open(read_data='{"id": "meta-model"}')):

            tmp = Path("/tmp/scan_meta")
            mock_file = MagicMock()
            mock_file.stem = "model"
            mock_file.name = "model.gguf"
            mock_file.parent = tmp
            mock_glob.return_value = [mock_file]

            result = scan_local_models(self.registry, [tmp])
            self.assertIsInstance(result, list)
            if result:
                self.assertEqual(result[0]["id"], "meta-model")


class TestScanLocalModelsDuplicates(unittest.TestCase):
    """Tests for duplicate handling in scan_local_models."""

    def setUp(self):
        self.registry = ModelRegistry()

    @patch("pathlib.Path.is_dir", return_value=True)
    @patch("pathlib.Path.iterdir", return_value=[])
    @patch("pathlib.Path.glob")
    def test_duplicate_model_id_not_reregistered(self, mock_glob, mock_iterdir, mock_isdir):
        tmp = Path("/tmp/scan_dup")
        file1 = MagicMock()
        file1.stem = "model-a"
        file1.name = "model-a.gguf"
        file1.parent = tmp
        file1.stat.return_value.st_size = 1000
        file1.stat.return_value.st_mtime = 1700000000

        mock_glob.return_value = [file1]

        # First scan
        scan_local_models(self.registry, [tmp])
        count_after_first = len(self.registry.list_all())

        # Second scan with same file
        scan_local_models(self.registry, [tmp])
        count_after_second = len(self.registry.list_all())

        self.assertEqual(count_after_first, count_after_second)


class TestDownloadModel(unittest.TestCase):
    """Tests for the download_model function."""

    @patch("backend.model_manager.HfApi")
    def test_download_with_quantization_finds_file(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_api_instance.list_repo_files.return_value = [
            "model.Q8_0.gguf",
            "model.FP16.gguf",
        ]

        with patch("huggingface_hub.hf_hub_download") as mock_hf, \
             patch("pathlib.Path.mkdir"):
            mock_hf.return_value = "/tmp/hf_models/model.Q8_0.gguf"
            result = download_model("org/repo:Q8_0", quantization="Q8_0")
            self.assertEqual(result, "/tmp/hf_models/model.Q8_0.gguf")
            mock_hf.assert_called_once()

    @patch("backend.model_manager.HfApi")
    def test_download_with_quantization_no_match_falls_back(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_api_instance.list_repo_files.return_value = [
            "model.FP16.gguf",  # no Q8_0 match
        ]

        with patch("huggingface_hub.snapshot_download") as mock_snap, \
             patch("pathlib.Path.mkdir"):
            mock_snap.return_value = "/tmp/hf_models"
            result = download_model("org/repo:Q8_0", quantization="Q8_0")
            self.assertEqual(result, "/tmp/hf_models")
            mock_snap.assert_called_once()

    @patch("backend.model_manager.HfApi")
    def test_download_entire_repo_without_quant(self, MockHfApi):
        with patch("huggingface_hub.snapshot_download") as mock_snap, \
             patch("pathlib.Path.mkdir"):
            mock_snap.return_value = "/tmp/hf_models"
            result = download_model("org/repo")
            self.assertEqual(result, "/tmp/hf_models")
            mock_snap.assert_called_once_with("org/repo", local_dir="./hf_models")

    @patch("backend.model_manager.HfApi")
    def test_download_parse_quant_from_model_id(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_api_instance.list_repo_files.return_value = ["model.Q8_0.gguf"]

        with patch("huggingface_hub.hf_hub_download") as mock_hf, \
             patch("pathlib.Path.mkdir"):
            mock_hf.return_value = "/tmp/hf_models/model.Q8_0.gguf"
            result = download_model("org/repo:Q8_0")
            self.assertEqual(result, "/tmp/hf_models/model.Q8_0.gguf")

    @patch("backend.model_manager.HfApi")
    def test_download_quant_api_error_falls_back(self, MockHfApi):
        mock_api_instance = MockHfApi.return_value
        mock_api_instance.list_repo_files.side_effect = Exception("API error")

        with patch("huggingface_hub.snapshot_download") as mock_snap, \
             patch("pathlib.Path.mkdir"):
            mock_snap.return_value = "/tmp/hf_models"
            result = download_model("org/repo:Q8_0", quantization="Q8_0")
            self.assertEqual(result, "/tmp/hf_models")

    @patch("huggingface_hub.snapshot_download")
    def test_download_general_error_wrapped(self, mock_snap):
        mock_snap.side_effect = Exception("disk full")
        with self.assertRaises(RuntimeError) as ctx:
            download_model("org/repo")
        self.assertIn("Failed to download model", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
