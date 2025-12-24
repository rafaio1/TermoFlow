param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

function Ok($msg) { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

try {
  $status = Invoke-RestMethod -Method Get -Uri "$BaseUrl/" -TimeoutSec 10
  Ok "GET / -> $($status.status)"
} catch {
  Fail "GET / falhou: $($_.Exception.Message)"
  exit 1
}

try {
  $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health" -TimeoutSec 10
  Ok "GET /health -> $($health.status) (pg=$($health.postgres.status), mongo=$($health.mongo.status))"
} catch {
  Fail "GET /health falhou: $($_.Exception.Message)"
  exit 1
}

try {
  $created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/items" -TimeoutSec 10 -ContentType "application/json" -Body (@{
    name = "SmokeTest $(Get-Date -Format s)"
  } | ConvertTo-Json)

  Ok "POST /items -> created id=$($created.id)"
} catch {
  Fail "POST /items falhou: $($_.Exception.Message)"
  exit 1
}

try {
  $items = Invoke-RestMethod -Method Get -Uri "$BaseUrl/items" -TimeoutSec 10
  Ok "GET /items -> count=$($items.Count)"
} catch {
  Fail "GET /items falhou: $($_.Exception.Message)"
  exit 1
}

