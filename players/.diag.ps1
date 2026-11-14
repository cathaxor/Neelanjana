param([string]$Media)
Add-Type -AssemblyName PresentationCore
$p = New-Object System.Windows.Media.MediaPlayer
$p.Open([uri]$Media)
$p.Play()
for ($i = 0; $i -lt 8; $i++) {
  Start-Sleep -Milliseconds 500
  $pos = 0.0
  try { $pos = $p.Position.TotalSeconds } catch { }
  $dur = 'nil'
  try { $dur = $p.NaturalDuration.ToString() } catch { }
  $audio = $false
  try { $audio = $p.HasAudio } catch { }
  $buffering = $false
  try { $buffering = $p.IsBuffering } catch { }
  [Console]::Out.WriteLine("i=$i pos=$pos dur=$dur hasAudio=$audio buffering=$buffering")
}
$p.Stop()
$p.Close()
