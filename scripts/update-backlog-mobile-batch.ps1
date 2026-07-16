$path = "C:\Programming_Projects\GTDWorkflowApp\Claude_Prompts\Backlog.md"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$em = [char]0x2014

$old1 = "> **Last used numbers:** Known Issues $em **Issue#45** $em Code Quality $em **CQ#18** $em Feature Requests $em **FR#203**"
$new1 = "> **Last used numbers:** Known Issues $em **Issue#48** $em Code Quality $em **CQ#19** $em Feature Requests $em **FR#205**"
$content = $content.Replace($old1, $new1)

$cq18 = "- [ ] CQ#18 [GH#237] (2026-07-15) -- Product_Summary/ HTML docs stale since 2026-05-27 (FR#130); ~70 undocumented resolved items (FR#131-FR#201, Issue#34-45); scope/approach deferred, see GH#237"
$cq19 = "- [ ] CQ#19 [GH#245] (2026-07-16) -- Monitor useViewport performance -- called per-row/per-tree-node in TaskRow.jsx and TaskListHelpers.jsx (ProjectTree/ArchivedTree/DropLine), each with its own matchMedia/resize listeners; no known problem today, watch as task lists grow, see GH#245"
$content = $content.Replace($cq18, $cq18 + "`n" + $cq19)

$last = "- [FR#198 GH#231] Score vs throughput: legend note `"No task completion dates logged yet`" visible when tasks lack completedDate $em needs tasks with done=true but no completedDate set"
$newLine = "- [FR#205 GH#244] On-screen keyboard behavior on coach chat input / add-task input / detail-panel fields on real mobile Chrome -- needs production deployment (dev site unreachable from phone)"
$content = $content.Replace($last, $last + "`n" + $newLine)

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Output ("Backlog.md updated, length: " + (Get-Item $path).Length)
