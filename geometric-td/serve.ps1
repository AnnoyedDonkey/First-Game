# Tiny static file server for local testing (no installs needed).
# Run:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8420
#
# Balance Lab writes are intentionally localhost-only. A future explicit
# -LabLan mode may widen access, but L3 never binds to a LAN interface.

# Port precedence: explicit -Port arg, else the PORT env var (used by the
# preview harness to assign a free port), else 8420.
param([int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8420 }))

$root = [IO.Path]::GetFullPath($PSScriptRoot)
$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".md"   = "text/plain; charset=utf-8"
}

$balanceSchemaVersion = 1
$maxApiBodyBytes = 2MB
$utf8NoBom = New-Object Text.UTF8Encoding($false)
$expectedBalanceKeys = @(
  "enemies", "towers", "towerUpgrades", "economy", "waveDefaults",
  "endless", "endlessRewards", "levelMilestones", "loot", "skills",
  "levels", "worlds"
)
$balanceJsonPath = [IO.Path]::GetFullPath((Join-Path $root "src\balance-data.json"))
$balanceJsPath = [IO.Path]::GetFullPath((Join-Path $root "src\balance-data.js"))
$historyRoot = [IO.Path]::GetFullPath((Join-Path $root "balance-history"))
$manifestPath = [IO.Path]::GetFullPath((Join-Path $historyRoot "manifest.json"))

function Assert-ProjectPath([string]$Path) {
  $fullPath = [IO.Path]::GetFullPath($Path)
  $rootPrefix = $root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is outside the project root."
  }
  return $fullPath
}

function ConvertTo-JsonString([string]$Value) {
  return ConvertTo-Json -InputObject $Value -Compress
}

function Write-ApiJson($Context, [int]$StatusCode, $Payload) {
  $response = $Context.Response
  $response.StatusCode = $StatusCode
  $response.ContentType = "application/json; charset=utf-8"
  $response.Headers.Set("Cache-Control", "no-store")
  $json = ConvertTo-Json -InputObject $Payload -Depth 30 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.OutputStream.Close()
}

function Write-ApiError($Context, [int]$StatusCode, [string]$Error, [string]$Code) {
  Write-ApiJson $Context $StatusCode ([ordered]@{ error = $Error; code = $Code })
}

function Read-ApiBody($Request) {
  if ($Request.ContentLength64 -gt $maxApiBodyBytes) {
    return [PSCustomObject]@{ TooLarge = $true; Text = $null }
  }

  $memory = New-Object IO.MemoryStream
  $buffer = New-Object byte[] 8192
  $total = 0
  while (($read = $Request.InputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
    $total += $read
    if ($total -gt $maxApiBodyBytes) {
      $memory.Dispose()
      return [PSCustomObject]@{ TooLarge = $true; Text = $null }
    }
    $memory.Write($buffer, 0, $read)
  }

  $encoding = $Request.ContentEncoding
  if ($null -eq $encoding) { $encoding = [Text.Encoding]::UTF8 }
  $text = $encoding.GetString($memory.ToArray())
  $memory.Dispose()
  return [PSCustomObject]@{ TooLarge = $false; Text = $text }
}

function Read-JsonFile([string]$Path) {
  $safePath = Assert-ProjectPath $Path
  if (-not (Test-Path -LiteralPath $safePath -PathType Leaf)) {
    throw "Required Balance Lab file is missing."
  }
  return ([IO.File]::ReadAllText($safePath, [Text.Encoding]::UTF8) | ConvertFrom-Json)
}

function Test-BalanceStructure($Data) {
  $errors = New-Object Collections.Generic.List[string]
  if ($null -eq $Data -or $Data -is [Array] -or $Data -is [string] -or $Data -is [ValueType]) {
    $errors.Add("data must be a JSON object")
    return [PSCustomObject]@{ ok = $false; errors = @($errors) }
  }

  $propertyNames = @($Data.PSObject.Properties.Name)
  if ($propertyNames -notcontains "schemaVersion") {
    $errors.Add("data.schemaVersion is required")
  } elseif ($Data.schemaVersion -ne $balanceSchemaVersion) {
    $errors.Add("data.schemaVersion must equal $balanceSchemaVersion")
  }
  foreach ($key in $expectedBalanceKeys) {
    if ($propertyNames -notcontains $key) { $errors.Add("data.$key is required") }
  }

  return [PSCustomObject]@{ ok = ($errors.Count -eq 0); errors = @($errors) }
}

# Extracts a top-level property without reserializing the deep balance object.
# The browser runs balance-schema.js for authoritative semantic validation;
# PowerShell deliberately provides only this structural gate.
function Get-TopLevelJsonPropertyRaw([string]$Text, [string]$PropertyName) {
  $length = $Text.Length
  $i = 0
  while ($i -lt $length -and [char]::IsWhiteSpace($Text[$i])) { $i++ }
  if ($i -ge $length -or $Text[$i] -ne '{') { throw "Request body must be a JSON object." }
  $i++

  while ($i -lt $length) {
    while ($i -lt $length -and [char]::IsWhiteSpace($Text[$i])) { $i++ }
    if ($i -lt $length -and $Text[$i] -eq '}') { break }
    if ($i -ge $length -or $Text[$i] -ne '"') { throw "Invalid JSON property name." }

    $keyStart = $i
    $i++
    $escaped = $false
    while ($i -lt $length) {
      $ch = $Text[$i]
      if ($escaped) { $escaped = $false }
      elseif ($ch -eq '\') { $escaped = $true }
      elseif ($ch -eq '"') { $i++; break }
      $i++
    }
    $rawKey = $Text.Substring($keyStart, $i - $keyStart)
    $key = $rawKey | ConvertFrom-Json

    while ($i -lt $length -and [char]::IsWhiteSpace($Text[$i])) { $i++ }
    if ($i -ge $length -or $Text[$i] -ne ':') { throw "Invalid JSON property separator." }
    $i++
    while ($i -lt $length -and [char]::IsWhiteSpace($Text[$i])) { $i++ }
    $valueStart = $i

    if ($i -lt $length -and ($Text[$i] -eq '{' -or $Text[$i] -eq '[')) {
      $depth = 0
      $inString = $false
      $escaped = $false
      while ($i -lt $length) {
        $ch = $Text[$i]
        if ($inString) {
          if ($escaped) { $escaped = $false }
          elseif ($ch -eq '\') { $escaped = $true }
          elseif ($ch -eq '"') { $inString = $false }
        } else {
          if ($ch -eq '"') { $inString = $true }
          elseif ($ch -eq '{' -or $ch -eq '[') { $depth++ }
          elseif ($ch -eq '}' -or $ch -eq ']') {
            $depth--
            if ($depth -eq 0) { $i++; break }
          }
        }
        $i++
      }
    } elseif ($i -lt $length -and $Text[$i] -eq '"') {
      $i++
      $escaped = $false
      while ($i -lt $length) {
        $ch = $Text[$i]
        if ($escaped) { $escaped = $false }
        elseif ($ch -eq '\') { $escaped = $true }
        elseif ($ch -eq '"') { $i++; break }
        $i++
      }
    } else {
      while ($i -lt $length -and $Text[$i] -ne ',' -and $Text[$i] -ne '}') { $i++ }
    }

    if ($key -ceq $PropertyName) {
      return $Text.Substring($valueStart, $i - $valueStart).Trim()
    }

    while ($i -lt $length -and [char]::IsWhiteSpace($Text[$i])) { $i++ }
    if ($i -lt $length -and $Text[$i] -eq ',') { $i++; continue }
    if ($i -lt $length -and $Text[$i] -eq '}') { break }
  }
  throw "Required JSON property is missing."
}

# Normalizes whitespace without parsing or changing property order, number
# lexemes, or string contents. This keeps canonical data at two-space indent.
function Format-JsonText([string]$Text) {
  $builder = New-Object Text.StringBuilder
  $indent = 0
  $inString = $false
  $escaped = $false
  for ($i = 0; $i -lt $Text.Length; $i++) {
    $ch = $Text[$i]
    if ($inString) {
      [void]$builder.Append($ch)
      if ($escaped) { $escaped = $false }
      elseif ($ch -eq '\') { $escaped = $true }
      elseif ($ch -eq '"') { $inString = $false }
      continue
    }

    if ([char]::IsWhiteSpace($ch)) { continue }
    switch ($ch) {
      '"' { $inString = $true; [void]$builder.Append($ch) }
      '{' {
        [void]$builder.Append($ch)
        $indent++
        $j = $i + 1
        while ($j -lt $Text.Length -and [char]::IsWhiteSpace($Text[$j])) { $j++ }
        if ($j -lt $Text.Length -and $Text[$j] -ne '}') {
          [void]$builder.Append("`n").Append(('  ' * $indent))
        }
      }
      '[' {
        [void]$builder.Append($ch)
        $indent++
        $j = $i + 1
        while ($j -lt $Text.Length -and [char]::IsWhiteSpace($Text[$j])) { $j++ }
        if ($j -lt $Text.Length -and $Text[$j] -ne ']') {
          [void]$builder.Append("`n").Append(('  ' * $indent))
        }
      }
      '}' {
        $indent--
        $previous = if ($builder.Length -gt 0) { $builder[$builder.Length - 1] } else { [char]0 }
        if ($previous -ne '{') { [void]$builder.Append("`n").Append(('  ' * $indent)) }
        [void]$builder.Append($ch)
      }
      ']' {
        $indent--
        $previous = if ($builder.Length -gt 0) { $builder[$builder.Length - 1] } else { [char]0 }
        if ($previous -ne '[') { [void]$builder.Append("`n").Append(('  ' * $indent)) }
        [void]$builder.Append($ch)
      }
      ',' { [void]$builder.Append(",`n").Append(('  ' * $indent)) }
      ':' { [void]$builder.Append(": ") }
      default { [void]$builder.Append($ch) }
    }
  }
  return $builder.ToString() + "`n"
}

function New-BalanceModuleText([string]$DataJson) {
  return @(
    '// GENERATED FILE - the Balance Lab rewrites the data block below on every save.'
    '// Edit balance values through the Lab (or balance-data.json), never here by hand.'
    'import { SCHEMA_VERSION } from "./balance-schema.js";'
    ''
    '// @BALANCE-DATA-START'
    'export const BALANCE = ' + $DataJson.TrimEnd() + ';'
    '// @BALANCE-DATA-END'
    ''
    'export { SCHEMA_VERSION };'
    ''
  ) -join "`n"
}

function Write-AtomicNewFile([string]$Path, [string]$Text) {
  $safePath = Assert-ProjectPath $Path
  $tempPath = Assert-ProjectPath ($safePath + ".tmp")
  [IO.File]::WriteAllText($tempPath, $Text, $utf8NoBom)
  [IO.File]::Move($tempPath, $safePath)
}

function Write-AtomicReplacement([string]$Path, [string]$Text) {
  $safePath = Assert-ProjectPath $Path
  $tempPath = Assert-ProjectPath ($safePath + ".tmp")
  $backupPath = Assert-ProjectPath ($safePath + ".replace-backup.tmp")
  if (Test-Path -LiteralPath $backupPath) { [IO.File]::Delete($backupPath) }
  [IO.File]::WriteAllText($tempPath, $Text, $utf8NoBom)
  [IO.File]::Replace($tempPath, $safePath, $backupPath)
  [IO.File]::Delete($backupPath)
}

function Get-BalanceState {
  $manifest = Read-JsonFile $manifestPath
  $data = Read-JsonFile $balanceJsonPath
  if ($manifest.schemaVersion -ne $balanceSchemaVersion -or $data.schemaVersion -ne $balanceSchemaVersion) {
    throw "Balance schema version mismatch."
  }
  if ([string]::IsNullOrWhiteSpace([string]$manifest.activeRevision)) {
    throw "Balance manifest has no active revision."
  }
  $active = @($manifest.revisions | Where-Object { $_.id -ceq $manifest.activeRevision })
  if ($active.Count -ne 1) { throw "Balance manifest active revision is invalid." }
  return [PSCustomObject]@{ Manifest = $manifest; Data = $data }
}

function New-RevisionId($Manifest) {
  $stamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHHmmss'Z'")
  $ids = @($Manifest.revisions | ForEach-Object { $_.id })
  for ($counter = 1; $counter -le 999; $counter++) {
    $candidate = "{0}-{1:D3}" -f $stamp, $counter
    $candidatePath = Join-Path $historyRoot ($candidate + ".json")
    if ($ids -cnotcontains $candidate -and -not (Test-Path -LiteralPath $candidatePath)) {
      return $candidate
    }
  }
  throw "Could not allocate a revision id."
}

function Save-BalanceRevision($State, [string]$DataJson, [string]$Note) {
  $formattedData = Format-JsonText $DataJson
  $revisionId = New-RevisionId $State.Manifest
  $createdAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss'Z'")
  $snapshotPath = Assert-ProjectPath (Join-Path $historyRoot ($revisionId + ".json"))
  $snapshotText = '{"schemaVersion":' + $balanceSchemaVersion +
    ',"createdAt":' + (ConvertTo-JsonString $createdAt) +
    ',"note":' + (ConvertTo-JsonString $Note) +
    ',"data":' + $formattedData.Trim() + '}' + "`n"

  $moduleText = New-BalanceModuleText $formattedData
  $newEntry = [PSCustomObject][ordered]@{
    id = $revisionId
    createdAt = $createdAt
    note = $Note
    dataSchemaVersion = $balanceSchemaVersion
    file = $revisionId + ".json"
  }
  $revisions = @($State.Manifest.revisions) + @($newEntry)
  $newManifest = [PSCustomObject][ordered]@{
    schemaVersion = $balanceSchemaVersion
    activeRevision = $revisionId
    revisions = $revisions
  }
  $manifestText = (ConvertTo-Json -InputObject $newManifest -Depth 20 -Compress) + "`n"

  # Order is deliberate: immutable snapshot, active JSON, generated module,
  # then manifest pointer. Every individual file swap is same-volume atomic.
  Write-AtomicNewFile $snapshotPath $snapshotText
  Write-AtomicReplacement $balanceJsonPath $formattedData
  Write-AtomicReplacement $balanceJsPath $moduleText
  Write-AtomicReplacement $manifestPath $manifestText

  return $revisionId
}

function Invoke-BalanceApi($Context, [string]$Path) {
  try {
    $request = $Context.Request
    if (-not [Net.IPAddress]::IsLoopback($request.RemoteEndPoint.Address)) {
      Write-ApiError $Context 403 "Balance Lab is available only from localhost." "loopback_required"
      return
    }

    $method = $request.HttpMethod.ToUpperInvariant()
    if ($method -ne "GET" -and $method -ne "POST") {
      $Context.Response.Headers.Set("Allow", "GET, POST")
      Write-ApiError $Context 405 "Method not allowed." "method_not_allowed"
      return
    }

    $knownGet = @("/api/balance", "/api/balance/history")
    $knownPost = @("/api/balance/validate", "/api/balance/save", "/api/balance/restore")
    if ($knownGet -cnotcontains $Path -and $knownPost -cnotcontains $Path) {
      Write-ApiError $Context 404 "Balance API path not found." "not_found"
      return
    }

    if ($method -eq "GET") {
      if ($knownGet -cnotcontains $Path) {
        Write-ApiError $Context 405 "Method not allowed." "method_not_allowed"
        return
      }
      $state = Get-BalanceState
      if ($Path -ceq "/api/balance") {
        Write-ApiJson $Context 200 ([ordered]@{
          schemaVersion = $balanceSchemaVersion
          revision = $state.Manifest.activeRevision
          data = $state.Data
        })
      } else {
        Write-ApiJson $Context 200 ([ordered]@{
          schemaVersion = $balanceSchemaVersion
          activeRevision = $state.Manifest.activeRevision
          revisions = @($state.Manifest.revisions)
        })
      }
      return
    }

    if ($knownPost -cnotcontains $Path) {
      Write-ApiError $Context 405 "Method not allowed." "method_not_allowed"
      return
    }
    $contentType = [string]$request.ContentType
    if ([string]::IsNullOrWhiteSpace($contentType) -or
        $contentType.Split(';')[0].Trim().ToLowerInvariant() -ne "application/json") {
      Write-ApiError $Context 415 "Content-Type must be application/json." "unsupported_media_type"
      return
    }

    $bodyRead = Read-ApiBody $request
    if ($bodyRead.TooLarge) {
      Write-ApiError $Context 413 "Request body exceeds the 2 MB limit." "body_too_large"
      return
    }
    try { $body = $bodyRead.Text | ConvertFrom-Json }
    catch {
      Write-ApiError $Context 400 "Request body is not valid JSON." "invalid_json"
      return
    }
    if ($null -eq $body -or $body -is [Array] -or $body -is [string] -or $body -is [ValueType]) {
      Write-ApiError $Context 400 "Request body must be a JSON object." "invalid_body"
      return
    }

    if ($Path -ceq "/api/balance/validate") {
      $result = Test-BalanceStructure $body.data
      Write-ApiJson $Context 200 ([ordered]@{
        ok = $result.ok
        errors = @($result.errors)
        validation = "structural-only; run src/balance-schema.js in the client for semantic validation"
      })
      return
    }

    $state = Get-BalanceState
    if ($Path -ceq "/api/balance/save") {
      if ([string]::IsNullOrWhiteSpace([string]$body.baseRevision)) {
        Write-ApiError $Context 400 "baseRevision is required." "base_revision_required"
        return
      }
      if ([string]$body.baseRevision -cne [string]$state.Manifest.activeRevision) {
        Write-ApiError $Context 409 "Balance data changed after this draft was loaded." "stale_revision"
        return
      }
      $note = [string]$body.note
      if ([string]::IsNullOrWhiteSpace($note) -or $note.Length -gt 500) {
        Write-ApiError $Context 400 "A non-empty revision note of at most 500 characters is required." "invalid_note"
        return
      }
      $result = Test-BalanceStructure $body.data
      if (-not $result.ok) {
        Write-ApiJson $Context 422 ([ordered]@{ error = "Balance data failed structural validation."; code = "invalid_structure"; errors = @($result.errors) })
        return
      }
      try { $dataRaw = Get-TopLevelJsonPropertyRaw $bodyRead.Text "data" }
      catch {
        Write-ApiError $Context 400 "Could not read the data property." "invalid_data_property"
        return
      }
      $revisionId = Save-BalanceRevision $state $dataRaw $note.Trim()
      Write-ApiJson $Context 200 ([ordered]@{ revision = $revisionId; activeRevision = $revisionId })
      return
    }

    $requestedRevision = [string]$body.revision
    if ([string]::IsNullOrWhiteSpace($requestedRevision)) {
      Write-ApiError $Context 400 "revision is required." "revision_required"
      return
    }
    if ($null -ne $body.PSObject.Properties["baseRevision"] -and
        [string]$body.baseRevision -cne [string]$state.Manifest.activeRevision) {
      Write-ApiError $Context 409 "Balance data changed after this restore was requested." "stale_revision"
      return
    }
    $matches = @($state.Manifest.revisions | Where-Object { $_.id -ceq $requestedRevision })
    if ($matches.Count -ne 1) {
      Write-ApiError $Context 404 "Revision not found." "revision_not_found"
      return
    }
    $sourceEntry = $matches[0]
    $expectedFile = $requestedRevision + ".json"
    if ([string]$sourceEntry.file -cne $expectedFile) {
      throw "Revision manifest entry has an invalid filename."
    }
    $sourcePath = Assert-ProjectPath (Join-Path $historyRoot $expectedFile)
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw "Revision snapshot is missing."
    }
    $sourceText = [IO.File]::ReadAllText($sourcePath, [Text.Encoding]::UTF8)
    $sourceSnapshot = $sourceText | ConvertFrom-Json
    $result = Test-BalanceStructure $sourceSnapshot.data
    if (-not $result.ok) { throw "Revision snapshot failed structural validation." }
    $sourceDataRaw = Get-TopLevelJsonPropertyRaw $sourceText "data"
    $restoreNote = "restored from $requestedRevision"
    if ($null -ne $body.PSObject.Properties["note"] -and -not [string]::IsNullOrWhiteSpace([string]$body.note)) {
      if ([string]$body.note.Length -gt 500) {
        Write-ApiError $Context 400 "Restore note must be at most 500 characters." "invalid_note"
        return
      }
      $restoreNote += ": " + ([string]$body.note).Trim()
    }
    $revisionId = Save-BalanceRevision $state $sourceDataRaw $restoreNote
    Write-ApiJson $Context 200 ([ordered]@{ revision = $revisionId; activeRevision = $revisionId })
  } catch {
    Write-Warning ("Balance API error: " + $_.Exception.Message)
    if ($Context.Response.OutputStream.CanWrite) {
      Write-ApiError $Context 500 "Balance Lab request failed." "internal_error"
    }
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port  (Ctrl+C to stop)"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $reqPath = $context.Request.Url.AbsolutePath
  if ($reqPath.StartsWith("/api/balance", [StringComparison]::Ordinal)) {
    Invoke-BalanceApi $context $reqPath
    continue
  }

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
