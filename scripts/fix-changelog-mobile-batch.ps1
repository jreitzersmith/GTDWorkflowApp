$path = "C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Changelog.md"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$old48 = "| 2026-07-16 | Bug Fix      | Issue#48 | GH#242 | Toolbar toggle buttons (gear and plus toggles) below touch-target size -- bumped to padding 8px 14px, minHeight 40, fontSize 13 in TaskBucketView.jsx | (pending commit) |"
$new48 = "| 2026-07-16 | Bug Fix      | Issue#48 | GH#242 | Toolbar toggle buttons (gear and plus toggles) below touch-target size -- first pass (padding 8px 14px) caused the plus-toggle to overflow the Projects row on live device test; corrected to padding 6px 9px, minHeight 36, fontSize 15 (smaller box, bigger glyph) in TaskBucketView.jsx | (pending commit) |"
$content = $content.Replace($old48, $new48)

$old46 = "| 2026-07-16 | Bug Fix      | Issue#46 | GH#240 | Off-screen right:0 popovers on phone -- Display popover (TaskBucketView.jsx), Move submenu (TaskRow.jsx), Export popovers x2 (ExportPopover.jsx), Today's Focus export (TodaysFocusView.jsx) -- all now left-anchored and viewport-capped on phone, matching Sort popover pattern | (pending commit) |"
$new46 = "| 2026-07-16 | Bug Fix      | Issue#46 | GH#240 | Off-screen right:0 popovers on phone -- Display popover (TaskBucketView.jsx) and Move submenu (TaskRow.jsx) left-anchored and viewport-capped, matching Sort popover pattern; the 3 Export popovers (ExportPopover.jsx x2, TodaysFocusView.jsx) regressed on live device test when left-anchored (their triggers sit at the right end of the toolbar row) -- corrected to stay right:0 with the viewport-width cap only | (pending commit) |"
$content = $content.Replace($old46, $new46)

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Output ("Changelog.md updated, length: " + (Get-Item $path).Length)
