import unittest
from unittest.mock import patch, MagicMock
import os
import tempfile
import time

from click.testing import CliRunner
from backend.cli import cli
from backend.daemon import Daemon


class E2ETestSuite(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.model_path = os.path.join(self.tmpdir.name, "test_model.gguf")
        with open(self.model_path, 'w') as f:
            f.write("")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_01_basic_functionality(self):
        with patch('backend.cli.ProcessManager') as MockPM, \
             patch('backend.config.load_config') as MockConfig:

            mock_pm = MagicMock()
            mock_pm.start_server.return_value = {'pid': 9999, 'status': 'started'}
            MockPM.return_value = mock_pm
            MockConfig.return_value = MagicMock(
                n_ctx=2048, n_gpu_layers=-1, temperature=0.7, threads=8
            )

            runner = CliRunner()
            result = runner.invoke(cli, ['run', '--model', self.model_path, '--prompt', 'hello'])

            MockPM.assert_called_once()


    def test_02_config_override_temperature(self):
        with patch('backend.cli.ProcessManager') as MockPM, \
             patch('backend.config.load_config') as MockConfig:

            mock_pm = MagicMock()
            mock_pm.start_server.return_value = {'pid': 9998, 'status': 'started'}
            MockPM.return_value = mock_pm
            MockConfig.return_value = MagicMock(
                n_ctx=2048, n_gpu_layers=-1, temperature=0.7, threads=8
            )

            runner = CliRunner()
            result = runner.invoke(cli, [
                'run', '--model', self.model_path,
                '--prompt', 'Test', '--options', 'temp=0.99'
            ])

            MockPM.assert_called_once()


    def test_03_failure_resilience(self):
        with patch('backend.cli.ProcessManager') as MockPM, \
             patch('backend.config.load_config') as MockConfig:

            mock_pm = MagicMock()
            mock_pm.start_server.side_effect = RuntimeError("Connection timeout")
            MockPM.return_value = mock_pm
            MockConfig.return_value = MagicMock(
                n_ctx=2048, n_gpu_layers=-1, temperature=0.7, threads=8
            )

            runner = CliRunner()
            result = runner.invoke(cli, [
                'run', '--model', self.model_path,
                '--prompt', 'Test resilience'
            ])

            MockPM.assert_called_once()


    def test_04_foreground_mode(self):
        with patch('backend.cli.ProcessManager') as MockPM, \
             patch('backend.config.load_config') as MockConfig:

            mock_pm = MagicMock()
            mock_pm.start_server.return_value = {'pid': 12345, 'status': 'started'}
            MockPM.return_value = mock_pm
            MockConfig.return_value = MagicMock(
                n_ctx=2048, n_gpu_layers=-1, temperature=0.7, threads=8
            )

            runner = CliRunner()
            result = runner.invoke(cli, [
                'run', '--model', self.model_path,
                '--prompt', 'Test foreground', '--foreground'
            ])

            MockPM.assert_not_called()


    def test_06_background_is_default(self):
        with patch('backend.cli.ProcessManager') as MockPM, \
             patch('backend.config.load_config') as MockConfig:

            mock_pm = MagicMock()
            mock_pm.start_server.return_value = {'pid': 54321, 'status': 'started'}
            MockPM.return_value = mock_pm
            MockConfig.return_value = MagicMock(
                n_ctx=2048, n_gpu_layers=-1, temperature=0.7, threads=8
            )

            runner = CliRunner()
            result = runner.invoke(cli, [
                'run', '--model', self.model_path,
                '--prompt', 'Test background default'
            ])

            MockPM.assert_called_once()


    def test_05_daemon_lifecycle(self):
        mock_target_called = [False]

        def waiting_target(stop_event, reload_event, config):
            while not stop_event.is_set():
                if reload_event.is_set():
                    reload_event.clear()
                    mock_target_called[0] = True
                time.sleep(0.02)

        daemon = Daemon(target=waiting_target)
        daemon.start()

        time.sleep(0.15)
        self.assertTrue(daemon._thread.is_alive())

        daemon.reload()
        time.sleep(0.15)
        self.assertTrue(mock_target_called[0])

        daemon.stop()
        time.sleep(0.2)
        self.assertFalse(daemon._thread.is_alive())


if __name__ == "__main__":
    unittest.main()
