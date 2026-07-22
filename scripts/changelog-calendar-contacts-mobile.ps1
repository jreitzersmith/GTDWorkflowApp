$path = "C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Changelog.md"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$anchor = "| Date       | Type         | #       | GH#   | Name                                                              | Commit(s)         |"
$newRows = @"
| 2026-07-16 | Feature      | -       | -      | Contacts mobile: phone now shows the contact list OR the selected contact's detail as a single full-width view (with a Back button), instead of a cramped two-pane split; tablet/desktop unchanged (ContactsPanel.jsx, ContactDetail.jsx) | (pending commit) |
| 2026-07-16 | Feature      | -       | -      | Calendar mobile pass: mobile top bar shows "Calendar" instead of "GTD Manager" on that page; redundant in-page "Calendar" label dropped on phone; Month/Week/Day tabs + prev/next/Today/refresh resized to fit one row; Month grid now fills remaining screen height with all 6 week rows dividing it equally (CalendarManagementView.jsx, CalendarEventDisplay.jsx, App.jsx) | (pending commit) |
| 2026-07-16 | Feature      | -       | -      | Calendar mobile: "New calendar events" and "Tasks with due dates" sections now collapsed by default on phone (CalendarManagementSections.jsx) | (pending commit) |
"@

if ($content -notmatch [regex]::Escape($anchor)) {
  Write-Output "ERROR: anchor not found"
} else {
  $content = $content.Replace($anchor, $anchor + "`n" + $newRows.Trim())
  [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
  Write-Output ("Changelog.md updated, length: " + (Get-Item $path).Length)
}
