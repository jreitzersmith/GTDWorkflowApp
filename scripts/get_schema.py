"""
get_schema.py — Fetch live Supabase schema for dev/AI sessions.

Usage:
    python scripts/get_schema.py

Reads SUPABASE_MANAGEMENT_TOKEN from .env in the project root.
Project ref is hardcoded (tudmteqljgpocffalssz).
Queries information_schema.columns for the public schema and prints
a formatted table/column listing.

Uses curl.exe rather than urllib — the Supabase Management API blocks
Python's default user-agent via Cloudflare.
"""

import json
import os
import subprocess
import sys

PROJECT_REF = "tudmteqljgpocffalssz"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

QUERY = """
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
"""


def load_env(path=".env"):
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    env[key.strip()] = value.strip()
    except FileNotFoundError:
        pass
    return env


def fetch_schema(token):
    payload = json.dumps({"query": QUERY})
    result = subprocess.run(
        [
            "curl.exe", "-s",
            "-X", "POST", API_URL,
            "-H", f"Authorization: Bearer {token}",
            "-H", "Content-Type: application/json",
            "-d", payload,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl.exe failed: {result.stderr}")

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Unexpected response: {result.stdout[:300]}")

    if isinstance(data, dict) and "error" in data:
        raise RuntimeError(f"API error: {data['error']}")
    if isinstance(data, dict) and "message" in data:
        raise RuntimeError(f"API error: {data['message']}")

    return data


def format_schema(rows):
    tables = {}
    for row in rows:
        tbl = row["table_name"]
        if tbl not in tables:
            tables[tbl] = []
        tables[tbl].append(row)

    lines = []
    for tbl, cols in sorted(tables.items()):
        lines.append(f"TABLE: {tbl}")
        for col in cols:
            nullable = "" if col["is_nullable"] == "YES" else " NOT NULL"
            default = f"  default: {col['column_default']}" if col["column_default"] else ""
            lines.append(f"  {col['column_name']:<30} {col['data_type']}{nullable}{default}")
        lines.append("")
    return "\n".join(lines)


def main():
    env = load_env()
    token = env.get("SUPABASE_MANAGEMENT_TOKEN") or os.environ.get("SUPABASE_MANAGEMENT_TOKEN")

    if not token:
        print("ERROR: SUPABASE_MANAGEMENT_TOKEN not found in .env or environment.")
        print("Expected key: SUPABASE_MANAGEMENT_TOKEN")
        sys.exit(1)

    print(f"Fetching schema for project {PROJECT_REF}...\n")
    try:
        rows = fetch_schema(token)
    except RuntimeError as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    if not rows:
        print("ERROR: API returned empty response. Check token and project ref.")
        sys.exit(1)

    print(format_schema(rows))
    print(f"({len(rows)} columns across {len({r['table_name'] for r in rows})} tables)")


if __name__ == "__main__":
    main()
