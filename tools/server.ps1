# 开发用静态服务器（无缓存）+ POST /save 写文件（仅限 assets/ 目录），仅本机访问
$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:8765/')
$listener.Start()
Write-Host "serving $root at http://127.0.0.1:8765/"
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.webp'='image/webp'; '.mp3'='audio/mpeg' }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($req.HttpMethod -eq 'POST' -and $path -eq '/save') {
      # /save?f=assets/xxx.png  body=二进制
      $name = $req.QueryString['f']
      $ok = $false
      if ($name -and $name -notmatch '\.\.' -and $name -match '^assets/') {
        $target = Join-Path $root ($name -replace '/', '\')
        $dir = Split-Path -Parent $target
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
        $ms = New-Object System.IO.MemoryStream
        $req.InputStream.CopyTo($ms)
        [System.IO.File]::WriteAllBytes($target, $ms.ToArray())
        $ok = $true
      }
      $resp = [System.Text.Encoding]::UTF8.GetBytes($(if ($ok) { 'ok' } else { 'bad' }))
      $ctx.Response.StatusCode = $(if ($ok) { 200 } else { 400 })
      $ctx.Response.OutputStream.Write($resp, 0, $resp.Length)
      $ctx.Response.Close()
      continue
    }
    if ($path -eq '/') { $path = '/index.html' }
    $file = Join-Path $root ($path -replace '/', '\')
    if ((Test-Path $file) -and (Resolve-Path $file).Path.StartsWith($root)) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { }
}
