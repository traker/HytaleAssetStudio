from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from backend.core.io import read_json, write_json
from backend.core.models import PackSource, ProjectCreateRequest
from backend.core.workspace_service import create_project, list_projects


class CreateProjectTests(unittest.TestCase):
    def make_request(self, target_dir: Path) -> ProjectCreateRequest:
        return ProjectCreateRequest(
            projectId="demo-project",
            displayName="Demo Project",
            targetDir=str(target_dir),
            vanilla=PackSource(sourceType="folder", path="K:/vanilla/Assets"),
        )

    def test_create_project_writes_expected_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root = Path(tmp)
            project_root = workspace_root / "projects" / "demo-project"

            response = create_project(workspace_root, self.make_request(project_root))

            self.assertEqual(response.projectId, "demo-project")
            self.assertTrue((project_root / "Common").is_dir())
            self.assertTrue((project_root / "Server").is_dir())
            self.assertTrue((project_root / "manifest.json").is_file())
            self.assertTrue((project_root / "has.project.json").is_file())

            manifest = read_json(project_root / "manifest.json")
            self.assertEqual(manifest["Group"], "demo-project")
            self.assertEqual(manifest["Name"], "Demo Project")

    def test_create_project_does_not_overwrite_existing_project_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root = Path(tmp)
            project_root = workspace_root / "projects" / "demo-project"
            project_root.mkdir(parents=True)
            existing_manifest = {"Group": "existing", "Name": "Existing"}
            write_json(project_root / "manifest.json", existing_manifest)

            with self.assertRaises(HTTPException) as ctx:
                create_project(workspace_root, self.make_request(project_root))

            self.assertEqual(ctx.exception.status_code, 409)
            self.assertEqual(read_json(project_root / "manifest.json"), existing_manifest)
            self.assertFalse((project_root / "has.project.json").exists())

    def test_create_project_rolls_back_partial_write_on_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root = Path(tmp)
            project_root = workspace_root / "projects" / "demo-project"

            real_write_json = write_json

            def flaky_write_json(path: Path, data: dict) -> None:
                if path.name == "has.project.json":
                    raise OSError("simulated write failure")
                real_write_json(path, data)

            with patch("backend.core.workspace_service.write_json", side_effect=flaky_write_json):
                with self.assertRaises(HTTPException) as ctx:
                    create_project(workspace_root, self.make_request(project_root))

            self.assertEqual(ctx.exception.status_code, 500)
            self.assertFalse(project_root.exists())

    def test_list_projects_includes_invalid_entries_with_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root = Path(tmp)
            valid_root = workspace_root / "projects" / "demo-project"
            invalid_root = workspace_root / "projects" / "broken-project"

            create_project(workspace_root, self.make_request(valid_root))
            invalid_root.mkdir(parents=True)
            (invalid_root / "has.project.json").write_text("{ invalid json", encoding="utf-8")

            projects = list_projects(workspace_root)
            by_id = {project.projectId: project for project in projects}

            self.assertEqual(by_id["demo-project"].status, "ready")
            self.assertEqual(by_id["broken-project"].status, "invalid")
            self.assertTrue(by_id["broken-project"].errorMessage)


if __name__ == "__main__":
    unittest.main()