# File Editing Rules — GTDWorkflowApp

Never use the Edit tool for files in this project. It consistently injects null bytes and truncates files.

## Root cause

The workspace mount is **virtiofs FUSE**. The FUSE page cache does NOT auto-invalidate when Windows-side processes (git commit/checkout, PowerShell, rebase) modify a file. Subsequent reads from the sandbox return a stale cached version — truncated at the size of the last sandbox write. This is a known issue affecting both the `Read` tool and `bash` commands in the sandbox. `stat` operations also report stale sizes.

Two distinct failure modes:
1. **Edit tool** — always broken on this mount. Injects null bytes and corrupts offsets. Never use it.
2. **Stale FUSE read** — Python or the Read tool reads a file that Windows/git modified since the last sandbox write. Stale content gets used for editing, then written back — corrupting or truncating the file.

---

## Preferred method — desktop-commander file tools (host-side)

`mcp__desktop-commander__read_file` and `mcp__desktop-commander__write_file` run natively on the Windows host, bypassing the FUSE layer entirely. Always fresh — no cache issue.

- **Reading:** `mcp__desktop-commander__read_file` with the Windows path — works for committed and uncommitted files
- **Writing:** `mcp__desktop-commander__write_file` — writes directly to Windows filesystem
- **Do not use `mcp__desktop-commander__edit_block`** — treat same as the Edit tool until proven otherwise
- **After any write:** verify with `mcp__desktop-commander__get_file_info` or `wc -c` to confirm byte count

---

## Fallback method — git show + Python 'w' mode

Use if desktop-commander file tools are unavailable or fail.

- **Reading for edits:** `subprocess.run(['git','show','HEAD:path'])` — reads from git's ext4 object store, bypasses FUSE cache entirely. Always fresh for committed content. Does NOT reflect uncommitted changes.
- **Writing:** `open(path, 'w')` — `O_TRUNC` punches through FUSE to Windows
- **Never `open(path, 'a')`** — append mode seeks to the cached (stale) EOF offset
- **Never `open(path, 'r')` or the Read tool** for files being edited — subject to stale cache
- Use `str.replace(old, new)` — never regex on JSX
- Verify each replacement succeeded before writing
- **After any write:** confirm size with `wc -c`

---

## Stale `.git/index.lock`

If a git command fails with a lock error, the lock file may be a FUSE cache artifact rather than a real lock. Safe to delete `.git/index.lock` and retry.
