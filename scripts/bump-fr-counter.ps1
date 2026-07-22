$p = 'C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Backlog.md'
$c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)

$old = "Feature Requests " + [char]0x2014 + " **FR#201**"
$new = "Feature Requests " + [char]0x2014 + " **FR#202**"

$count = ([regex]::Matches($c, [regex]::Escape($old))).Count
Write-Output ("Occurrences: " + $count)
if ($count -ne 1) { Write-Output "ABORT - not exactly one match"; exit 1 }

$c = $c.Replace($old, $new)
[System.IO.File]::WriteAllText($p, $c, [System.Text.Encoding]::UTF8)
Write-Output "DONE"
