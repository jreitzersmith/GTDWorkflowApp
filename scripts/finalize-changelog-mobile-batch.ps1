$path = "C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Changelog.md"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$anchor = "| Date       | Type         | #       | GH#   | Name                                                              | Commit(s)         |"
$newRows = @"
| 2026-07-16 | Feature      | -       | -      | Add collapsible add-task toggle ("plus" button next to Filter) for Inbox/Next Actions/Done on phone, matching the existing Projects add-project pattern -- requested during live device retest of Issue#48 | (pending commit) |
| 2026-07-16 | Bug Fix      | Issue#48 | GH#242 | Toolbar toggle buttons: final pass -- regrouped "gear"/"plus" toggles into the same wrapping flex container as the Filter field (instead of a forced separate row) so they stay on one row together and wrap as a unit with no overflow, in TaskBucketView.jsx | (pending commit) |
| 2026-07-16 | Bug Fix      | Issue#46 | GH#240 | AI Coach conversation Export button was completely off-screen on phone (CoachPanel.jsx header row had no flexWrap) -- added flexWrap/rowGap so it wraps to its own line instead of being pushed out of view | (pending commit) |
"@

if ($content -notmatch [regex]::Escape($anchor)) {
  Write-Output "ERROR: anchor not found"
} else {
  $content = $content.Replace($anchor, $anchor + "`n" + $newRows.Trim())
  [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
  Write-Output ("Changelog.md updated, length: " + (Get-Item $path).Length)
}
