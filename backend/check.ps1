
# ============================================================
# Claims AI Backend - Complete API Test Script
# ============================================================
#
# Usage:
#   1. Start the API service
#   2. Start the AI service
#   3. Run:
#
#      powershell -ExecutionPolicy Bypass -File .\check.ps1
#
# Default:
#   API     = http://localhost:4000
#   AI      = http://localhost:4100
#
# Change these if your services use different ports.
# ============================================================

$ErrorActionPreference = "Stop"

$API = "http://localhost:4000"
$AI  = "http://localhost:4100"

$EMAIL = "officer@example.com"
$PASSWORD = "Password123!"

$global:Token = $null
$global:ClaimId = $null
$script:FailureCount = 0

function Print-Header {
    param([string]$Text)

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Print-Test {
    param([string]$Text)

    Write-Host ""
    Write-Host "[TEST] $Text" -ForegroundColor Yellow
}

function Print-Success {
    param([string]$Text)

    Write-Host "[PASS] $Text" -ForegroundColor Green
}

function Print-Error {
    param([string]$Text)

    $script:FailureCount++
    Write-Host "[FAIL] $Text" -ForegroundColor Red
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [string]$ContentType = "application/json"
    )

    try {
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 10

            return Invoke-RestMethod `
                -Method $Method `
                -Uri $Url `
                -Headers $Headers `
                -ContentType $ContentType `
                -Body $json
        }
        else {
            return Invoke-RestMethod `
                -Method $Method `
                -Uri $Url `
                -Headers $Headers
        }
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__

        Write-Host "HTTP Status: $status" -ForegroundColor DarkYellow

        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message -ForegroundColor DarkGray
        }

        throw
    }
}

# ============================================================
# 1. HEALTH CHECK
# ============================================================

Print-Header "1. HEALTH CHECK"

Print-Test "GET /health"

try {
    $health = Invoke-Api `
        -Method GET `
        -Url "$API/health"

    $health | ConvertTo-Json -Depth 10

    if ($health.status -eq "ok" -or $health.status -eq "healthy") {
        Print-Success "Health endpoint is working"
    }
    else {
        Print-Success "Health endpoint responded"
    }
}
catch {
    Print-Error "Health endpoint failed"
    exit 1
}


# ============================================================
# 2. AI SERVICE HEALTH
# ============================================================

Print-Test "GET AI service health"

try {
    $aiHealth = Invoke-Api `
        -Method GET `
        -Url "$AI/health"

    $aiHealth | ConvertTo-Json -Depth 10

    Print-Success "AI service is reachable"
}
catch {
    Print-Error "AI service is not reachable"
    Write-Host "Make sure the AI service is running on $AI"
}


# ============================================================
# 3. LOGIN
# ============================================================

Print-Header "2. AUTHENTICATION"

Print-Test "POST /auth/login"

$loginBody = @{
    email = $EMAIL
    password = $PASSWORD
}

try {
    $login = Invoke-Api `
        -Method POST `
        -Url "$API/auth/login" `
        -Body $loginBody

    $login | ConvertTo-Json -Depth 10

    if (!$login.token) {
        throw "Login response did not contain token"
    }

    $global:Token = $login.token

    Print-Success "Login successful"
    Print-Success "JWT token received"
}
catch {
    Print-Error "Login failed"
    Write-Host ""
    Write-Host "Make sure the demo user has been seeded." -ForegroundColor Yellow
    Write-Host "Example:"
    Write-Host "npm run seed"
    exit 1
}


$AuthHeaders = @{
    Authorization = "Bearer $global:Token"
}


# ============================================================
# 4. INVALID JWT TEST
# ============================================================

Print-Test "GET /api/claims with invalid JWT"

try {
    Invoke-RestMethod `
        -Method GET `
        -Uri "$API/api/claims" `
        -Headers @{
            Authorization = "Bearer invalid-token"
        }

    Print-Error "Invalid JWT was incorrectly accepted"
}
catch {
    Print-Success "Invalid JWT correctly rejected"
}


# ============================================================
# 5. GET ALL CLAIMS
# ============================================================

Print-Header "3. CLAIM RETRIEVAL"

Print-Test "GET /api/claims"

try {
    $claims = Invoke-Api `
        -Method GET `
        -Url "$API/api/claims" `
        -Headers $AuthHeaders

    $claims | ConvertTo-Json -Depth 10

    Print-Success "Claims retrieved"

    # Try to identify first claim
    if ($null -ne $claims.items) {
        $firstClaim = $claims.items | Select-Object -First 1
    }
    elseif ($claims.data) {
        $firstClaim = $claims.data | Select-Object -First 1
    }
    elseif ($claims.claims) {
        $firstClaim = $claims.claims | Select-Object -First 1
    }
    elseif ($claims -is [array]) {
        $firstClaim = $claims | Select-Object -First 1
    }
    else {
        $firstClaim = $claims
    }

    if ($firstClaim._id) {
        $global:ClaimId = $firstClaim._id
    }
    elseif ($firstClaim.id) {
        $global:ClaimId = $firstClaim.id
    }

    if ($global:ClaimId) {
        Print-Success "Using claim ID: $global:ClaimId"
    }
}
catch {
    Print-Error "Could not retrieve claims"
}


# ============================================================
# 6. CLAIM FILTERS
# ============================================================

Print-Header "4. CLAIM FILTERING"

Print-Test "Filter by claim type"

try {
    $result = Invoke-Api `
        -Method GET `
        -Url "$API/api/claims?type=MOTOR" `
        -Headers $AuthHeaders

    $result | ConvertTo-Json -Depth 10

    Print-Success "Claim type filtering works"
}
catch {
    Print-Error "Claim type filter failed"
}


Print-Test "Filter by status"

try {
    $result = Invoke-Api `
        -Method GET `
        -Url "$API/api/claims?status=NEW" `
        -Headers $AuthHeaders

    $result | ConvertTo-Json -Depth 10

    Print-Success "Status filtering works"
}
catch {
    Print-Error "Status filter failed"
}


Print-Test "Filter by priority"

try {
    $result = Invoke-Api `
        -Method GET `
        -Url "$API/api/claims?priority=HIGH" `
        -Headers $AuthHeaders

    $result | ConvertTo-Json -Depth 10

    Print-Success "Priority filtering works"
}
catch {
    Print-Error "Priority filter failed"
}


Print-Test "Combined filters"

try {
    $result = Invoke-Api `
        -Method GET `
        -Url "$API/api/claims?type=MOTOR&status=NEW&priority=HIGH" `
        -Headers $AuthHeaders

    $result | ConvertTo-Json -Depth 10

    Print-Success "Combined filtering works"
}
catch {
    Print-Error "Combined filtering failed"
}


# ============================================================
# 7. GET CLAIM DETAILS
# ============================================================

Print-Header "5. CLAIM DETAILS"

if (!$global:ClaimId) {
    Print-Error "No claim ID available. Skipping claim detail tests."
}
else {

    Print-Test "GET /api/claims/:id"

    try {
        $claim = Invoke-Api `
            -Method GET `
            -Url "$API/api/claims/$global:ClaimId" `
            -Headers $AuthHeaders

        $claim | ConvertTo-Json -Depth 10

        Print-Success "Claim details retrieved"
    }
    catch {
        Print-Error "Claim details failed"
    }
}


# ============================================================
# 8. POLICY SEARCH
# ============================================================

Print-Header "6. POLICY RAG"

Print-Test "GET /api/policies/search"

try {

    $policyResult = Invoke-Api `
        -Method GET `
        -Url "$API/api/policies/search?q=motor%20accident%20coverage" `
        -Headers $AuthHeaders

    $policyResult | ConvertTo-Json -Depth 10

    Print-Success "Policy search works"
}
catch {
    Print-Error "Policy search failed"
    Write-Host ""
    Write-Host "If this fails, verify:" -ForegroundColor Yellow
    Write-Host "CHROMA_HOST"
    Write-Host "CHROMA_API_KEY"
    Write-Host "CHROMA_TENANT"
    Write-Host "CHROMA_DATABASE"
}


# ============================================================
# 9. AI SERVICE DIRECT TEST
# ============================================================

Print-Header "7. AI SERVICE"

Print-Test "Direct AI assessment request"

    try {

        $aiBody = @{
            claim = @{
                claimNumber = "TEST-001"
                policyNumber = "POL-001"
                customerName = "Test Customer"
                claimType = "MOTOR"
                status = "UNDER_REVIEW"
                priority = "HIGH"
                incidentDescription = "Vehicle was damaged in a road accident."
                claimedAmount = 25000
            }
        }

        $aiResult = Invoke-Api `
            -Method POST `
            -Url "$AI/v1/assess" `
            -Body $aiBody

        $aiResult | ConvertTo-Json -Depth 20

        if ($aiResult.degraded -or !$aiResult.assessment) {
            throw "AI assessment unavailable: $($aiResult.error)"
        }

        Print-Success "AI assessment endpoint works"
    }
    catch {
        Print-Error "AI assessment failed: $($_.Exception.Message)"
    }


# ============================================================
# 10. GENERATE CLAIM ASSESSMENT
# ============================================================

Print-Header "8. CLAIM AI ASSESSMENT"

if (!$global:ClaimId) {
    Print-Error "No claim ID available. Skipping assessment."
}
else {

    Print-Test "POST /api/claims/:id/generate-assessment"

    try {

        $assessment = Invoke-Api `
            -Method POST `
            -Url "$API/api/claims/$global:ClaimId/generate-assessment" `
            -Headers $AuthHeaders `
            -Body @{}

        $assessment | ConvertTo-Json -Depth 20

        if ($assessment.degraded -or !$assessment.assessment) {
            throw "AI assessment unavailable: $($assessment.error)"
        }

        Print-Success "AI assessment generated"
    }
    catch {
        Print-Error "AI assessment generation failed: $($_.Exception.Message)"
    }
}


# ============================================================
# 11. DOCUMENT UPLOAD
# ============================================================

Print-Header "9. DOCUMENT UPLOAD"

if (!$global:ClaimId) {
    Print-Error "No claim ID available. Skipping document upload."
}
else {

    Print-Test "POST /api/claims/:id/documents"

    $testFile = Join-Path $PSScriptRoot "test-document.txt"

    "Test supporting document for claims backend." |
        Out-File -FilePath $testFile -Encoding utf8

    try {

        $headers = @{
            Authorization = "Bearer $global:Token"
        }

        $curlResult = & curl.exe `
            -s `
            --fail-with-body `
            -X POST `
            "$API/api/claims/$global:ClaimId/documents" `
            -H "Authorization: Bearer $global:Token" `
            -F "document=@$testFile"

        Write-Host $curlResult
        if ($LASTEXITCODE -ne 0) {
            throw "Document upload failed (curl exit code $LASTEXITCODE)"
        }

        Print-Success "Document upload request completed"
    }
    catch {
        Print-Error "Document upload failed"
    }
}


# ============================================================
# 12. STATUS UPDATE
# ============================================================

Print-Header "10. CLAIM STATUS"

if (!$global:ClaimId) {
    Print-Error "No claim ID available. Skipping status tests."
}
else {

    Print-Test "PATCH /api/claims/:id/status"

    try {

        $currentClaim = Invoke-Api `
            -Method GET `
            -Url "$API/api/claims/$global:ClaimId" `
            -Headers $AuthHeaders

        $nextStatus = switch ($currentClaim.status) {
            "NEW" { "UNDER_REVIEW" }
            "UNDER_REVIEW" { "ADDITIONAL_INFO_REQUIRED" }
            "ADDITIONAL_INFO_REQUIRED" { "UNDER_REVIEW" }
            default { throw "Claim status '$($currentClaim.status)' cannot be used for the review lifecycle test." }
        }

        $statusBody = @{
            status = $nextStatus
        }

        $statusResult = Invoke-Api `
            -Method PATCH `
            -Url "$API/api/claims/$global:ClaimId/status" `
            -Headers $AuthHeaders `
            -Body $statusBody

        $statusResult | ConvertTo-Json -Depth 10

        if ($statusResult.status -ne $nextStatus) {
            throw "Status response did not confirm '$nextStatus'"
        }

        Print-Success "Claim status updated to $nextStatus"
    }
    catch {
        Print-Error "Status update failed: $($_.Exception.Message)"
    }
}


# ============================================================
# 13. INVALID STATUS TRANSITION
# ============================================================

Print-Test "Test invalid claim status transition"

if ($global:ClaimId) {

    try {

        $invalidStatus = @{
            status = "CLOSED"
        }

        Invoke-Api `
            -Method PATCH `
            -Url "$API/api/claims/$global:ClaimId/status" `
            -Headers $AuthHeaders `
            -Body $invalidStatus

        Print-Error "Invalid status transition was accepted"
    }
    catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 409) {
            Print-Success "Invalid status transition correctly rejected"
        }
        else {
            Print-Error "Expected HTTP 409 for invalid transition: $($_.Exception.Message)"
        }
    }
}


# ============================================================
# 14. GET UPDATED CLAIM
# ============================================================

Print-Test "GET updated claim"

if ($global:ClaimId) {

    try {

        $updatedClaim = Invoke-Api `
            -Method GET `
            -Url "$API/api/claims/$global:ClaimId" `
            -Headers $AuthHeaders

        $updatedClaim | ConvertTo-Json -Depth 20

        Print-Success "Updated claim retrieved"
    }
    catch {
        Print-Error "Could not retrieve updated claim"
    }
}


# ============================================================
# 15. FINAL SUMMARY
# ============================================================

Print-Header "TEST COMPLETE"

Write-Host ""
Write-Host "Backend endpoint test sequence completed. Failures: $script:FailureCount"
Write-Host ""
Write-Host "Services tested:"
Write-Host "  API: http://localhost:4000"
Write-Host "  AI : http://localhost:4100"
Write-Host ""
Write-Host "Core flow:"
Write-Host "  Login"
Write-Host "    -> JWT"
Write-Host "    -> Claims"
Write-Host "    -> Filters"
Write-Host "    -> Claim Details"
Write-Host "    -> Policy RAG"
Write-Host "    -> AI Assessment"
Write-Host "    -> Document Upload"
Write-Host "    -> Status Update"
Write-Host "    -> Lifecycle Validation"
Write-Host ""
Write-Host "Claim ID used: $global:ClaimId"
Write-Host ""

if ($script:FailureCount -gt 0) {
    throw "Backend checks failed: $script:FailureCount failure(s). Review the [FAIL] messages above."
}

