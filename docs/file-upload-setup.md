# File Upload Configuration Guide

This guide explains how to set up file uploads for the signup process. The system supports both **local storage** and **AWS S3** (recommended for production).

## Overview

The `FileUploadService` handles all file uploads with the following features:

- **Images**: CAC documents (JPEG, PNG, WebP) - max 10MB
- **Documents**: Shareholders approval letters (PDF, Word) - max 25MB
- **Validation**: File type and size validation
- **Cleanup**: Automatic cleanup of uploaded files on signup failure

## Configuration Options

### Option 1: Local Storage (Development)

Local storage is configured by default for development.

**Environment Variable:**
```bash
DRIVE_DISK=local
```

Files are stored in `tmp/uploads/` directory and served at `/uploads` endpoint.

### Option 2: AWS S3 (Production - Recommended)

For scalable production use, configure AWS S3:

#### Step 1: Install S3 Driver

```bash
npm install @adonisjs/drive-s3
```

#### Step 2: Enable S3 in `config/drive.ts`

Uncomment the S3 configuration:

```typescript
s3: {
  driver: 's3',
  visibility: 'public',
  key: Env.get('S3_KEY'),
  secret: Env.get('S3_SECRET'),
  region: Env.get('S3_REGION'),
  bucket: Env.get('S3_BUCKET'),
  endpoint: Env.get('S3_ENDPOINT'),
},
```

#### Step 3: Set Environment Variables

Add to your `.env` file:

```bash
DRIVE_DISK=s3

# AWS S3 Configuration
S3_KEY=your_aws_access_key
S3_SECRET=your_aws_secret_key
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ENDPOINT=https://s3.amazonaws.com  # Optional: for custom endpoints (Minio, etc)
```

#### Step 4: Create S3 Bucket

In AWS Console:
1. Create a new S3 bucket
2. Enable public access (for serving files)
3. Configure CORS policy:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

#### Step 5: Create IAM User (Security Best Practice)

Instead of using root AWS credentials:
1. Create IAM user with S3 access only
2. Attach `AmazonS3FullAccess` policy
3. Use IAM user credentials in `.env`

## Signup Request Example

### Using cURL (Starter Business)

```bash
curl -X POST http://localhost:3333/user/account/signup \
  -F "email=user@example.com" \
  -F "password=password123" \
  -F "password_confirmation=password123" \
  -F "phone=1234567890" \
  -F "business_name=My Startup" \
  -F "business_type=starter" \
  -F "bvn=12345678901"
```

### Using cURL (Registered Business)

```bash
curl -X POST http://localhost:3333/user/account/signup \
  -F "email=company@example.com" \
  -F "password=password123" \
  -F "password_confirmation=password123" \
  -F "phone=1234567890" \
  -F "business_name=My Company Ltd" \
  -F "business_type=registered" \
  -F "bvn=12345678901" \
  -F "cac_number=RC1234567" \
  -F "cac_documents=@/path/to/cac_document.jpg" \
  -F "shareholders_approval_letter=@/path/to/letter.pdf"
```

### Using Postman

1. Create a POST request to `{{baseUrl}}/user/account/signup`
2. Select **Body** > **form-data**
3. Add fields:

| Key | Type | Value |
|-----|------|-------|
| email | Text | user@example.com |
| password | Text | password123 |
| password_confirmation | Text | password123 |
| phone | Text | 1234567890 |
| business_name | Text | My Business |
| business_type | Text | registered |
| bvn | Text | 12345678901 |
| cac_number | Text | RC1234567 |
| cac_documents | File | Select image file (JPG/PNG/WebP) |
| shareholders_approval_letter | File | Select PDF or Word file |

## Success Response

```json
{
  "error": false,
  "data": "User created!",
  "code": 200,
  "result": {
    "id": 1,
    "unique_id": "a1b2c3d4-e5f6-4a2b-8c9d-0e1f2a3b4c5d",
    "email": "user@example.com",
    "business_name": "My Business",
    "business_type": "registered",
    "bvn": "12345678901",
    "cac_number": "RC1234567",
    "cac_documents": "[{\"filename\":\"cac_doc.jpg\",\"path\":\"cac-documents/a1b2c3d4-e5f6.../1632812400000-cac_doc.jpg\",\"url\":\"https://s3.amazonaws.com/bucket/cac-documents/...\",\"size\":2048000,\"mimeType\":\"image/jpeg\"}]",
    "shareholders_approval_letter": "{\"filename\":\"letter.pdf\",\"path\":\"approval-letters/a1b2c3d4-e5f6.../1632812400001-letter.pdf\",\"url\":\"https://s3.amazonaws.com/bucket/approval-letters/...\",\"size\":1024000,\"mimeType\":\"application/pdf\"}",
    "created_at": "2026-06-01T10:30:00.000+00:00",
    "updated_at": "2026-06-01T10:30:00.000+00:00"
  }
}
```

## Error Scenarios

### Missing Required Fields
```json
{
  "error": true,
  "message": "Validation failed",
  "errors": {
    "cac_number": ["CAC number is required for registered businesses"]
  },
  "code": 422
}
```

### Invalid File Type
```json
{
  "error": true,
  "data": "Invalid file type for CAC document. Allowed types: image/jpeg, image/png, image/webp, image/jpg",
  "details": "...",
  "code": 400
}
```

### File Too Large
```json
{
  "error": true,
  "data": "Approval letter is too large. Maximum size: 25MB",
  "details": "...",
  "code": 400
}
```

## Database Schema

The `users` table includes:
- `business_type`: 'starter' | 'registered'
- `bvn`: Bank Verification Number (11 digits)
- `cac_number`: CAC registration number (registered businesses only)
- `cac_documents`: JSON array of uploaded CAC document details
- `shareholders_approval_letter`: JSON object with approval letter details

Example stored data:
```json
{
  "cac_documents": [
    {
      "filename": "cac_doc.jpg",
      "path": "cac-documents/userId/1632812400000-cac_doc.jpg",
      "url": "https://s3.amazonaws.com/bucket/cac-documents/userId/...",
      "size": 2048000,
      "mimeType": "image/jpeg"
    }
  ],
  "shareholders_approval_letter": {
    "filename": "letter.pdf",
    "path": "approval-letters/userId/1632812400001-letter.pdf",
    "url": "https://s3.amazonaws.com/bucket/approval-letters/userId/...",
    "size": 1024000,
    "mimeType": "application/pdf"
  }
}
```

## Troubleshooting

### Files not uploading
- Check file size limits (10MB for images, 25MB for documents)
- Verify MIME types are supported
- Ensure S3 bucket exists and credentials are correct
- Check `DRIVE_DISK` environment variable is set

### S3 connection errors
- Verify AWS credentials are correct
- Check S3 bucket region matches `S3_REGION`
- Ensure IAM user has S3 permissions
- Test with AWS CLI: `aws s3 ls --region your-region`

### File access errors after upload
- Verify S3 bucket has public access enabled
- Check CORS policy is configured correctly
- Ensure bucket policy allows `GetObject` permissions

