$path = "C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Backlog.md"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$em = [char]0x2014
$dot = [char]0x00B7

$old1 = "> **Last used numbers:** Known Issues $em **Issue#45** $dot Code Quality $em **CQ#18** $dot Feature Requests $em **FR#203**"
$new1 = "> **Last used numbers:** Known Issues $em **Issue#48** $dot Code Quality $em **CQ#19** $dot Feature Requests $em **FR#205**"
$count = ([regex]::Matches($content, [regex]::Escape($old1))).Count
$content = $content.Replace($old1, $new1)

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Output ("Match count: " + $count + " | Backlog.md length: " + (Get-Item $path).Length)
