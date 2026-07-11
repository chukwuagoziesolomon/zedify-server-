# Storage Configuration Examples

## Local Storage (Development)
DRIVE_DISK=local

## AWS S3 (Production)
DRIVE_DISK=s3

# AWS S3 Credentials
S3_KEY=your_aws_access_key_id
S3_SECRET=your_aws_secret_access_key
S3_REGION=us-east-1
S3_BUCKET=your-payments-bucket
S3_ENDPOINT=https://s3.amazonaws.com

## Google Cloud Storage (Alternative)
# DRIVE_DISK=gcs
# GCS_KEY_FILENAME=/path/to/service-account-key.json
# GCS_BUCKET=your-payments-bucket

## DigitalOcean Spaces (S3-compatible)
# DRIVE_DISK=s3
# S3_KEY=your_spaces_key
# S3_SECRET=your_spaces_secret
# S3_REGION=nyc3
# S3_BUCKET=your-payments-bucket
# S3_ENDPOINT=https://nyc3.digitaloceanspaces.com

## MinIO (Self-hosted S3-compatible)
# DRIVE_DISK=s3
# S3_KEY=minioadmin
# S3_SECRET=minioadmin
# S3_REGION=us-east-1
# S3_BUCKET=payments
# S3_ENDPOINT=http://minio:9000
