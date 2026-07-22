$p = 'C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Backlog.md'
$c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)

$marker = "#### Platform / reach"
$idx = $c.IndexOf($marker)
if ($idx -lt 0) { Write-Output "MARKER NOT FOUND"; exit 1 }
$insertAt = $idx + $marker.Length

$emdash = [char]0x2014
$entry = "`n`n- [ ] FR#202 [GH#238] (2026-07-15) $emdash Mobile: collapse/toggle Coach panel on phone/tablet $emdash height-cap quick fix landed in Phase 1 (min(coachHeight, 32vh)); full redesign (default collapsed, toggle, mode reconsideration) deferred, see GH#238"

$c = $c.Insert($insertAt, $entry)

[System.IO.File]::WriteAllText($p, $c, [System.Text.Encoding]::UTF8)
Write-Output "DONE"
Write-Output ("New size: " + (Get-Item $p).Length)
