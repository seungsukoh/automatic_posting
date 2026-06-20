from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from publishers import PublishPayload, publish_to_platform


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DATA_DIR = ROOT.parent / "data"
DB_PATH = Path(os.environ.get("AUTOMATICPOSTING_DB", DATA_DIR / "automaticposting.db"))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def select_db_path() -> Path:
    journal_path = Path(f"{DB_PATH}-journal")
    if DB_PATH.exists() and DB_PATH.stat().st_size == 0 and journal_path.exists():
        try:
            DB_PATH.unlink()
            journal_path.unlink()
        except OSError:
            return DATA_DIR / "automaticposting.local.db"
    return DB_PATH


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db_path = select_db_path()
    conn = sqlite3.connect(db_path)
    # This local MVP runs in constrained development folders where SQLite
    # rollback-journal files can fail. Use an in-memory journal for now.
    conn.execute("pragma journal_mode=memory")
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            create table if not exists posts (
                id integer primary key autoincrement,
                title text not null,
                body text not null,
                link_url text,
                hashtags text,
                image_name text,
                created_at text not null,
                updated_at text not null
            );

            create table if not exists post_targets (
                id integer primary key autoincrement,
                post_id integer not null,
                platform text not null,
                body_override text,
                status text not null default 'draft',
                created_at text not null,
                updated_at text not null,
                foreign key(post_id) references posts(id)
            );

            create table if not exists publish_jobs (
                id integer primary key autoincrement,
                post_target_id integer not null,
                platform text not null,
                scheduled_at text,
                started_at text,
                finished_at text,
                status text not null,
                retry_count integer not null default 0,
                error_message text,
                external_post_url text,
                created_at text not null,
                updated_at text not null,
                foreign key(post_target_id) references post_targets(id)
            );

            create table if not exists audit_logs (
                id integer primary key autoincrement,
                action text not null,
                target_type text not null,
                target_id integer,
                metadata text,
                created_at text not null
            );
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def audit(conn: sqlite3.Connection, action: str, target_type: str, target_id: int | None, metadata: dict[str, Any]) -> None:
    conn.execute(
        """
        insert into audit_logs (action, target_type, target_id, metadata, created_at)
        values (?, ?, ?, ?, ?)
        """,
        (action, target_type, target_id, json.dumps(metadata, ensure_ascii=False), utc_now()),
    )


def get_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    raw_length = handler.headers.get("Content-Length", "0")
    length = int(raw_length) if raw_length.isdigit() else 0
    if length <= 0:
        return {}
    body = handler.rfile.read(length).decode("utf-8")
    return json.loads(body) if body else {}


class AppHandler(BaseHTTPRequestHandler):
    server_version = "AutomaticPostingMVP/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.serve_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
            return
        if parsed.path.startswith("/static/"):
            requested = STATIC_DIR / parsed.path.removeprefix("/static/")
            self.serve_static(requested)
            return
        if parsed.path == "/api/health":
            self.send_json({"status": "ok", "time": utc_now()})
            return
        if parsed.path == "/api/posts":
            self.list_posts()
            return
        if parsed.path == "/api/jobs":
            self.list_jobs()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/posts":
            self.create_post()
            return
        if parsed.path.startswith("/api/posts/") and parsed.path.endswith("/publish"):
            post_id = parsed.path.split("/")[3]
            self.publish_post(int(post_id))
            return
        if parsed.path.startswith("/api/jobs/") and parsed.path.endswith("/retry"):
            job_id = parsed.path.split("/")[3]
            self.retry_job(int(job_id))
            return
        if parsed.path == "/api/scheduler/run":
            self.run_scheduler()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def serve_static(self, path: Path) -> None:
        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
        }
        self.serve_file(path, content_types.get(path.suffix, "application/octet-stream"))

    def serve_file(self, path: Path, content_type: str) -> None:
        try:
            resolved = path.resolve()
            if not str(resolved).startswith(str(STATIC_DIR.resolve())):
                self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
                return
            content = resolved.read_bytes()
        except FileNotFoundError:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, data: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def list_posts(self) -> None:
        with connect() as conn:
            posts = [row_to_dict(row) for row in conn.execute("select * from posts order by id desc")]
            for post in posts:
                targets = conn.execute("select * from post_targets where post_id = ? order by id", (post["id"],))
                post["targets"] = [row_to_dict(row) for row in targets]
        self.send_json({"posts": posts})

    def list_jobs(self) -> None:
        with connect() as conn:
            jobs = [
                row_to_dict(row)
                for row in conn.execute(
                    """
                    select j.*, p.title
                    from publish_jobs j
                    join post_targets t on t.id = j.post_target_id
                    join posts p on p.id = t.post_id
                    order by j.id desc
                    """
                )
            ]
        self.send_json({"jobs": jobs})

    def create_post(self) -> None:
        data = get_json_body(self)
        title = str(data.get("title", "")).strip()
        body = str(data.get("body", "")).strip()
        if not title or not body:
            self.send_json({"error": "title and body are required"}, HTTPStatus.BAD_REQUEST)
            return

        platforms = data.get("platforms") or []
        if not isinstance(platforms, list) or not platforms:
            self.send_json({"error": "at least one platform is required"}, HTTPStatus.BAD_REQUEST)
            return

        now = utc_now()
        with connect() as conn:
            cur = conn.execute(
                """
                insert into posts (title, body, link_url, hashtags, image_name, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    title,
                    body,
                    str(data.get("link_url", "")).strip(),
                    str(data.get("hashtags", "")).strip(),
                    str(data.get("image_name", "")).strip(),
                    now,
                    now,
                ),
            )
            post_id = int(cur.lastrowid)
            for platform in platforms:
                body_override = str(data.get("platform_bodies", {}).get(platform, "")).strip()
                conn.execute(
                    """
                    insert into post_targets (post_id, platform, body_override, status, created_at, updated_at)
                    values (?, ?, ?, 'draft', ?, ?)
                    """,
                    (post_id, str(platform), body_override, now, now),
                )
            audit(conn, "post.created", "post", post_id, {"platforms": platforms})
        self.send_json({"post_id": post_id}, HTTPStatus.CREATED)

    def publish_post(self, post_id: int) -> None:
        data = get_json_body(self)
        mode = str(data.get("mode", "now"))
        scheduled_at = data.get("scheduled_at") if mode == "scheduled" else None

        if mode == "scheduled" and parse_iso(scheduled_at) is None:
            self.send_json({"error": "scheduled_at is required for scheduled mode"}, HTTPStatus.BAD_REQUEST)
            return

        now = utc_now()
        jobs: list[dict[str, Any]] = []
        with connect() as conn:
            targets = list(conn.execute("select * from post_targets where post_id = ? order by id", (post_id,)))
            if not targets:
                self.send_json({"error": "post not found or no targets"}, HTTPStatus.NOT_FOUND)
                return

            for target in targets:
                status = "scheduled" if mode == "scheduled" else "queued"
                cur = conn.execute(
                    """
                    insert into publish_jobs
                    (post_target_id, platform, scheduled_at, status, created_at, updated_at)
                    values (?, ?, ?, ?, ?, ?)
                    """,
                    (target["id"], target["platform"], scheduled_at, status, now, now),
                )
                jobs.append({"job_id": int(cur.lastrowid), "platform": target["platform"], "status": status})
            audit(conn, "post.publish_requested", "post", post_id, {"mode": mode, "scheduled_at": scheduled_at})

        if mode != "scheduled":
            for job in jobs:
                self.execute_job(job["job_id"])
            with connect() as conn:
                jobs = [row_to_dict(row) for row in conn.execute("select * from publish_jobs where id in (%s)" % ",".join("?" for _ in jobs), [j["job_id"] for j in jobs])]

        self.send_json({"jobs": jobs}, HTTPStatus.CREATED)

    def retry_job(self, job_id: int) -> None:
        with connect() as conn:
            job = conn.execute("select * from publish_jobs where id = ?", (job_id,)).fetchone()
            if not job:
                self.send_json({"error": "job not found"}, HTTPStatus.NOT_FOUND)
                return
            if job["status"] not in {"failed", "queued"}:
                self.send_json({"error": "only failed or queued jobs can be retried"}, HTTPStatus.BAD_REQUEST)
                return
            conn.execute(
                "update publish_jobs set status = 'queued', retry_count = retry_count + 1, error_message = null, updated_at = ? where id = ?",
                (utc_now(), job_id),
            )
            audit(conn, "job.retry_requested", "publish_job", job_id, {})
        result = self.execute_job(job_id)
        self.send_json(result)

    def run_scheduler(self) -> None:
        now_dt = datetime.now(timezone.utc)
        processed: list[dict[str, Any]] = []
        with connect() as conn:
            rows = list(conn.execute("select * from publish_jobs where status = 'scheduled'"))
        for row in rows:
            due_at = parse_iso(row["scheduled_at"])
            if due_at and due_at <= now_dt:
                processed.append(self.execute_job(int(row["id"])))
        self.send_json({"processed": processed})

    def execute_job(self, job_id: int) -> dict[str, Any]:
        now = utc_now()
        with connect() as conn:
            job = conn.execute(
                """
                select j.*, p.title, p.body, p.link_url, p.hashtags, p.image_name, t.body_override
                from publish_jobs j
                join post_targets t on t.id = j.post_target_id
                join posts p on p.id = t.post_id
                where j.id = ?
                """,
                (job_id,),
            ).fetchone()
            if not job:
                return {"job_id": job_id, "status": "missing"}
            conn.execute(
                "update publish_jobs set status = 'running', started_at = ?, updated_at = ? where id = ?",
                (now, now, job_id),
            )
            payload = PublishPayload(
                title=job["title"],
                body=job["body"],
                link_url=job["link_url"] or "",
                hashtags=job["hashtags"] or "",
                image_name=job["image_name"] or "",
                platform_body=job["body_override"] or "",
            )
            result = publish_to_platform(job["platform"], payload)
            finished = utc_now()
            conn.execute(
                """
                update publish_jobs
                set status = ?, finished_at = ?, error_message = ?, external_post_url = ?, updated_at = ?
                where id = ?
                """,
                (
                    result["status"],
                    finished,
                    result["error_message"],
                    result["external_post_url"],
                    finished,
                    job_id,
                ),
            )
            audit(conn, "job.executed", "publish_job", job_id, result)
        return {"job_id": job_id, "platform": job["platform"], **result}

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> None:
    init_db()
    host = "127.0.0.1"
    port = 8000
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Automatic Posting MVP running at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
