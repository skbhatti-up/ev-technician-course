# Rebuilds the course HTML from the parts in src\ and prints it to PDF with Microsoft Edge.
# Run from PowerShell:  .\make-pdf.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Join-Path $root "EV-Hybrid-Technician-Course.html"
$pdf  = Join-Path $root "EV-Hybrid-Technician-Course.pdf"

py (Join-Path $root "src\build.py")

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$profileDir = Join-Path $env:TEMP "edge-evhtc"
$url = "file:///" + ($html -replace '\\', '/')

Start-Process -FilePath $edge -Wait -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
  "--user-data-dir=`"$profileDir`"", "--virtual-time-budget=8000",
  "--print-to-pdf=`"$pdf`"", "`"$url`""
)

$bytes = [System.IO.File]::ReadAllBytes($pdf)
$text  = [System.Text.Encoding]::GetEncoding(28591).GetString($bytes)
$pages = ([regex]::Matches($text, '/Type\s*/Page\b')).Count
"PDF written: $pdf  ($pages pages, $([math]::Round($bytes.Length / 1MB, 2)) MB)"
