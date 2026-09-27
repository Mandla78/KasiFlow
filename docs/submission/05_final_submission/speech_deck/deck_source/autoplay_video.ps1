<#
Sets the demo video inside the deck to start by itself when its slide opens,
so nobody has to find a play button mid-pitch. pptxgenjs can embed a video
but can't set its timing, so PowerPoint does it and saves the file. It also
writes the PDF next to the deck. Run it after build.js:

  cd docs\submission\05_final_submission\speech_deck
  node deck_source\build.js Akayza_Pitch_Speech_Deck.pptx
  powershell -ExecutionPolicy Bypass -File deck_source\autoplay_video.ps1 Akayza_Pitch_Speech_Deck.pptx

Needs PowerPoint, with the deck itself closed.
#>
param([Parameter(Mandatory = $true)][string]$Deck)
$ErrorActionPreference = 'Stop'

$path = (Resolve-Path $Deck).Path
# PowerPoint works on a copy outside OneDrive: saving straight into a synced folder
# raised a hidden dialog that hung PowerPoint and kept the deck locked.
$work = Join-Path $env:TEMP ('deck-autoplay-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $work | Out-Null
$copy = Join-Path $work (Split-Path $path -Leaf)
$pdf = [IO.Path]::ChangeExtension($copy, '.pdf')
Copy-Item $path $copy

$wasRunning = [bool](Get-Process POWERPNT -ErrorAction SilentlyContinue)
$app = New-Object -ComObject PowerPoint.Application
$app.DisplayAlerts = 1  # ppAlertsNone
try {
  $p = $app.Presentations.Open($copy, 0, 0, 0)  # read-write, no window
  $video = $null; $slide = $null; $number = 0
  for ($n = 1; $n -le $p.Slides.Count; $n++) {
    foreach ($sh in $p.Slides.Item($n).Shapes) {
      if ($sh.Type -eq 16 -and $sh.MediaType -eq 3) { $video = $sh; $slide = $p.Slides.Item($n); $number = $n }  # msoMedia, ppMediaTypeMovie
    }
  }
  if (-not $video) { throw 'No video found in the deck.' }

  # The first effect on its slide, "with previous": it plays as soon as the slide opens.
  $seq = $slide.TimeLine.MainSequence
  for ($i = $seq.Count; $i -ge 1; $i--) { if ($seq.Item($i).Shape.Name -eq $video.Name) { $seq.Item($i).Delete() } }
  $null = $seq.AddEffect($video, 83, 0, 2, 1)  # msoAnimEffectMediaPlay, no text level, msoAnimTriggerWithPrevious, first

  $p.Save()
  $p.SaveAs($pdf, 32)  # ppSaveAsPDF
  $p.Close()
} finally {
  if (-not $wasRunning) { $app.Quit() }
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}

Copy-Item $copy $path -Force
Copy-Item $pdf ([IO.Path]::ChangeExtension($path, '.pdf')) -Force
Remove-Item $copy, $pdf
Remove-Item $work
Write-Host "Slide ${number}: the video starts by itself. Saved the deck and wrote the PDF."
