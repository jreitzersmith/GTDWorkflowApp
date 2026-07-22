$p = 'C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Backlog.md'
$c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)

$oldHeader = "Feature Requests " + [char]0x2014 + " **FR#202**"
$newHeader = "Feature Requests " + [char]0x2014 + " **FR#203**"
$count = ([regex]::Matches($c, [regex]::Escape($oldHeader))).Count
if ($count -ne 1) { Write-Output ("ABORT header - matches: " + $count); exit 1 }
$c = $c.Replace($oldHeader, $newHeader)

$marker = "#### Platform / reach"
$idx = $c.IndexOf($marker)
if ($idx -lt 0) { Write-Output "MARKER NOT FOUND"; exit 1 }
$insertAt = $idx + $marker.Length

$emdash = [char]0x2014
$entry = "`n`n- [ ] FR#203 [GH#239] (2026-07-15) $emdash Mobile: touch-compatible drag-and-drop row reordering $emdash native HTML5 DnD has no touch support; drag handle hidden on phone/tablet as interim step; needs pointer-events-based reimplementation with long-press, auto-scroll, drop-target detection, see GH#239"

$c = $c.Insert($insertAt, $entry)

[System.IO.File]::WriteAllText($p, $c, [System.Text.Encoding]::UTF8)
Write-Output "DONE"
