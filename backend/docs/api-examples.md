# API examples

## Login

```http
POST /auth/login
Content-Type: application/json

{"email":"officer@example.com","password":"Password123!"}
```

## Claims

```http
GET /api/claims?status=UNDER_REVIEW&priority=HIGH
Authorization: Bearer <token>
```

## Status

```http
PATCH /api/claims/<claimId>/status
Authorization: Bearer <token>
Content-Type: application/json

{"status":"APPROVED"}
```

## Policy search

```http
GET /api/policies/search?q=motor collision deductible
Authorization: Bearer <token>
```

## Assessment

```http
POST /api/claims/<claimId>/generate-assessment
Authorization: Bearer <token>
```
