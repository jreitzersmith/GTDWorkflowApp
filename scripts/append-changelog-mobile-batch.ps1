$path = "C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Changelog.md"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$anchor = "| Date       | Type         | #       | GH#   | Name                                                              | Commit(s)         |"
$newRows = @"
| 2026-07-16 | Feature      | FR#204  | GH#243 | Switch app-shell 100vh to 100dvh -- .app-shell-height utility class in index.html (CSS-fallback via declaration order); applied to App.jsx root, AuthGate.jsx (2 screens), main.jsx crash fallback | (pending commit) |
| 2026-07-16 | Bug Fix      | Issue#48 | GH#242 | Toolbar toggle buttons (gear and plus toggles) below touch-target size -- bumped to padding 8px 14px, minHeight 40, fontSize 13 in TaskBucketView.jsx | (pending commit) |
| 2026-07-16 | Bug Fix      | Issue#47 | GH#241 | Task Detail Panel used width-only breakpoint instead of orientation-aware isPhone -- App.jsx detailPanel width now uses viewport.isPhone | (pending commit) |
| 2026-07-16 | Bug Fix      | Issue#46 | GH#240 | Off-screen right:0 popovers on phone -- Display popover (TaskBucketView.jsx), Move submenu (TaskRow.jsx), Export popovers x2 (ExportPopover.jsx), Today's Focus export (TodaysFocusView.jsx) -- all now left-anchored and viewport-capped on phone, matching Sort popover pattern | (pending commit) |
"@

if ($content -notmatch [regex]::Escape($anchor)) {
  Write-Output "ERROR: anchor not found"
} else {
  $content = $content.Replace($anchor, $anchor + "`n" + $newRows.Trim())
  [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
  Write-Output ("Changelog.md updated, length: " + (Get-Item $path).Length)
}
