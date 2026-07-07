# Tiny static file server for local testing (no installs needed).
# Run:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8420 (or http://<your-pc-ip>:8420 on your phone*)
#
# *Phone access requires listening on all interfaces, which Windows only
#  allows with admin rights. Without admin, this serves localhost only.

param([int]$Port = 8420)

$root = $PSScriptRoot
$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".md"   = "text/plain; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port  (Ctrl+C to stop)"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $reqPath = $context.Request.Url.AbsolutePath
  if ($reqPath -eq "/") { $reqPath = "/index.html" }
  $filePath = Join-Path $root ($reqPath -replace "/", "\")

  $response = $context.Response
  # Never serve files outside the project folder.
  $fullPath = [IO.Path]::GetFullPath($filePath)
  if (-not $fullPath.StartsWith($root) -or -not (Test-Path $fullPath -PathType Leaf)) {
    $response.StatusCode = 404
    $bytes = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
  } else {
    $ext = [IO.Path]::GetExtension($fullPath).ToLower()
    $type = $mime[$ext]
    if ($type) { $response.ContentType = $type }
    $response.Headers.Add("Cache-Control", "no-store")
    $bytes = [IO.File]::ReadAllBytes($fullPath)
  }
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.OutputStream.Close()
}
