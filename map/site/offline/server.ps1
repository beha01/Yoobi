# Карта Yoobi на своём компьютере: маленький веб-сервер только для этого компьютера
# (адрес 127.0.0.1, из сети к нему не подключиться). Запускается из «Открыть карту.bat».
# Работает в Windows PowerShell 5.1 (есть в каждой Windows 10 и 11) и в PowerShell 7.
param([int]$Port = 8765, [switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))

# Свободный порт: если 8765 занят, берём следующий.
$listener = $null
for ($p = $Port; $p -lt $Port + 30; $p++) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $p
    $l.Start()
    $listener = $l
    $Port = $p
    break
  } catch { }
}
if (-not $listener) { Write-Host 'Не нашёлся свободный порт для карты.'; exit 1 }

$url = "http://127.0.0.1:$Port/index.html"
Write-Host ''
Write-Host '  Карта Yoobi открыта в браузере:' $url
Write-Host '  Не закрывайте это окно, пока пользуетесь картой.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

# Каждый запрос — в своём потоке: браузер грузит тайлы, шрифты и код параллельно.
$handler = {
  param($client, $root)
  $types = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'; '.geojson' = 'application/json; charset=utf-8'
    '.txt' = 'text/plain; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.png' = 'image/png'
    '.svg' = 'image/svg+xml'; '.pbf' = 'application/x-protobuf'; '.pmtiles' = 'application/octet-stream'
    '.ico' = 'image/x-icon'; '.webp' = 'image/webp'; '.jpg' = 'image/jpeg'
  }
  try {
    $client.ReceiveTimeout = 15000
    $client.SendTimeout = 60000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
    $line = $reader.ReadLine()
    if (-not $line) { return }
    $range = $null
    while ($true) {
      $h = $reader.ReadLine()
      if ($h -eq $null -or $h -eq '') { break }
      if ($h -match '^Range:\s*bytes=(\d+)-(\d*)') { $range = @([long]$Matches[1], $Matches[2]) }
    }
    $parts = $line.Split(' ')
    $method = $parts[0]
    $path = [System.Uri]::UnescapeDataString(($parts[1] -split '\?')[0])
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root ($path.TrimStart('/') -replace '/', [System.IO.Path]::DirectorySeparatorChar)))
    $send = {
      param($status, $headers, $bytes)
      $text = "HTTP/1.1 $status`r`n" + (($headers.GetEnumerator() | ForEach-Object { "$($_.Key): $($_.Value)" }) -join "`r`n") + "`r`nConnection: close`r`n`r`n"
      $head = [System.Text.Encoding]::ASCII.GetBytes($text)
      $stream.Write($head, 0, $head.Length)
      if ($bytes) { $stream.Write($bytes, 0, $bytes.Length) }
    }
    if (($method -ne 'GET' -and $method -ne 'HEAD') -or -not $file.StartsWith($root) -or -not [System.IO.File]::Exists($file)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      & $send '404 Not Found' @{ 'Content-Type' = 'text/plain'; 'Content-Length' = $body.Length } $body
      return
    }
    $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
    $type = $types[$ext]
    if (-not $type) { $type = 'application/octet-stream' }
    $fs = [System.IO.File]::OpenRead($file)
    try {
      $size = $fs.Length
      $start = 0; $end = $size - 1; $status = '200 OK'
      $headers = [ordered]@{ 'Content-Type' = $type; 'Cache-Control' = 'no-cache'; 'Accept-Ranges' = 'bytes' }
      if ($range -and $size -gt 0) {
        $start = [Math]::Min($range[0], $size - 1)
        if ($range[1]) { $end = [Math]::Min([long]$range[1], $size - 1) }
        $status = '206 Partial Content'
        $headers['Content-Range'] = "bytes $start-$end/$size"
      }
      $headers['Content-Length'] = $end - $start + 1
      & $send $status $headers $null
      if ($method -eq 'GET' -and $size -gt 0) {
        [void]$fs.Seek($start, 'Begin')
        $left = $end - $start + 1
        $buf = New-Object byte[] 262144
        while ($left -gt 0) {
          $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $left))
          if ($n -le 0) { break }
          $stream.Write($buf, 0, $n)
          $left -= $n
        }
      }
    } finally { $fs.Dispose() }
  } catch { } finally { $client.Close() }
}

$pool = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspacePool(1, 12)
$pool.Open()
$jobs = New-Object System.Collections.ArrayList
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $ps = [PowerShell]::Create()
    $ps.RunspacePool = $pool
    [void]$ps.AddScript($handler).AddArgument($client).AddArgument($root)
    [void]$jobs.Add(@($ps, $ps.BeginInvoke()))
    # Завершённые запросы — убрать, чтобы память не росла.
    for ($i = $jobs.Count - 1; $i -ge 0; $i--) {
      if ($jobs[$i][1].IsCompleted) {
        try { [void]$jobs[$i][0].EndInvoke($jobs[$i][1]) } catch { }
        $jobs[$i][0].Dispose()
        $jobs.RemoveAt($i)
      }
    }
  }
} finally {
  $listener.Stop()
  $pool.Close()
}
