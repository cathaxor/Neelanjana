# Neelanjana terminal player - Windows audio engine
# Plays the audio track of a media file through WPF's MediaPlayer.
# Speaks a tiny line protocol on stdin/stdout so the Node CLI stays in control.
#
# stdin commands:  pause | resume | seek <seconds> | volume <0..1> | quit
# stdout events:   READY | POS <seconds> | WARN <message> | ERR <message>

param(
  [Parameter(Mandatory = $true)][string]$Media,
  [double]$StartAt = 0,
  [double]$Volume = 0.85
)

$ErrorActionPreference = 'Stop'
$inv = [Globalization.CultureInfo]::InvariantCulture

function Clamp([double]$v, [double]$lo, [double]$hi) {
  return [Math]::Max($lo, [Math]::Min($hi, $v))
}

try {
  Add-Type -AssemblyName PresentationCore
  Add-Type -AssemblyName WindowsBase
}
catch {
  [Console]::Out.WriteLine('ERR ' + $_.Exception.Message)
  exit 1
}

# PowerShell's [Console]::In is a SyncTextReader, so ReadLineAsync() blocks.
# Pump stdin on a real .NET background thread and poll a queue instead.
try {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Concurrent;
using System.Threading;

public static class StdinPump
{
    public static readonly ConcurrentQueue<string> Lines = new ConcurrentQueue<string>();

    public static void Start()
    {
        var thread = new Thread(() =>
        {
            try
            {
                string line;
                while ((line = Console.In.ReadLine()) != null)
                {
                    Lines.Enqueue(line);
                }
            }
            catch { }
        });
        thread.IsBackground = true;
        thread.Start();
    }
}
'@
  [StdinPump]::Start()
}
catch {
  [Console]::Out.WriteLine('ERR ' + $_.Exception.Message)
  exit 1
}

$script:player = New-Object System.Windows.Media.MediaPlayer
$script:player.Volume = Clamp $Volume 0 1
$script:running = $true
$script:opened = $false
$script:readySent = $false
$script:lastReport = [DateTime]::MinValue
$script:deadline = (Get-Date).AddSeconds(6)

function Send-Ready {
  if (-not $script:readySent) {
    $script:readySent = $true
    $script:player.Play()
    [Console]::Out.WriteLine('READY')
  }
}

$script:player.Add_MediaOpened({
  try {
    if ($StartAt -gt 0) {
      $script:player.Position = [TimeSpan]::FromSeconds((Clamp $StartAt 0 86400))
    }
  }
  catch { }
  $script:opened = $true
  Send-Ready
})

$script:player.Add_MediaFailed({
  param($sender, $args)
  try {
    [Console]::Out.WriteLine('ERR media failed: ' + $args.ErrorException.Message)
  }
  catch {
    [Console]::Out.WriteLine('ERR media failed')
  }
  $script:running = $false
})

try {
  $script:player.Open([Uri]$Media)
}
catch {
  [Console]::Out.WriteLine('ERR ' + $_.Exception.Message)
  exit 1
}

$script:timer = New-Object System.Windows.Threading.DispatcherTimer
$script:timer.Interval = [TimeSpan]::FromMilliseconds(100)

$script:timer.Add_Tick({
  $line = ''

  while ([StdinPump]::Lines.TryDequeue([ref]$line)) {
    $parts = $line.Trim() -split '\s+', 2
    $cmd = $parts[0].ToLowerInvariant()
    $arg = if ($parts.Length -gt 1) { $parts[1] } else { '' }

    switch ($cmd) {
      'pause' { try { $script:player.Pause() } catch { } }
      'resume' { try { $script:player.Play() } catch { } }
      'seek' {
        try {
          $target = [double]::Parse($arg, $inv)
          $script:player.Position = [TimeSpan]::FromSeconds((Clamp $target 0 86400))
        }
        catch { }
      }
      'volume' {
        try {
          $v = [double]::Parse($arg, $inv)
          $script:player.Volume = Clamp $v 0 1
        }
        catch { }
      }
      'quit' { $script:running = $false }
      default { }
    }
  }

  # If the media never raises MediaOpened, still try to play and let the
  # Node side fall back to its own wall clock.
  if (-not $script:opened -and (Get-Date) -gt $script:deadline) {
    $script:opened = $true
    Send-Ready
    [Console]::Out.WriteLine('WARN media did not report open yet')
  }

  $now = Get-Date
  if (($now - $script:lastReport).TotalMilliseconds -ge 200) {
    $pos = 0.0
    try { $pos = $script:player.Position.TotalSeconds } catch { }
    [Console]::Out.WriteLine([string]::Format($inv, 'POS {0:F3}', $pos))
    $script:lastReport = $now
  }

  if (-not $script:running) {
    $script:timer.Stop()
    [System.Windows.Threading.Dispatcher]::CurrentDispatcher.InvokeShutdown()
  }
})

$script:timer.Start()
[System.Windows.Threading.Dispatcher]::Run()
$script:timer.Stop()

try {
  $script:player.Stop()
  $script:player.Close()
}
catch { }
