# scripts/

Dev-session tools for AI-assisted development. Not part of the app bundle.

## get_schema.py

Fetches the live Supabase schema (tables and columns) via the Management API.

**When to use:**
- Before writing a migration — confirm current column names and types
- After running a migration — verify the change landed before proceeding to testing
- When describing project state — get authoritative table/column list rather than relying on SQL files in src/SQL/ (which may be stale)
- Any time you need to know what columns exist on a table

**How to run:**
```
python scripts/get_schema.py
```
Run from the project root. Reads `SUPABASE_MANAGEMENT_TOKEN` from `.env`.

**Output:** one block per table listing column name, data type, nullability, and default value.

**HALT:** exits with a clear error message if the token is missing or the API returns an error.
