import Env from '@ioc:Adonis/Core/Env'
import { MultipartFileContract } from '@ioc:Adonis/Core/BodyParser'
import { v2 as cloudinary } from 'cloudinary'

export interface UploadedFile {
  filename: string
  path: string
  url: string
  size: number
  mimeType: string
}

export class FileUploadService {
  constructor() {
    const cloudName = Env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey = Env.get('CLOUDINARY_API_KEY')
    const apiSecret = Env.get('CLOUDINARY_API_SECRET')

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      })
    }
  }
  /**
   * Allowed image MIME types for CAC documents
   * Includes common variations from different browsers/clients
   */
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/x-png', // Some systems send this
    'image/x-webp', // Some systems send this
  ]

  /**
   * Allowed image file extensions
   */
  private readonly ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

  /**
   * Allowed document MIME types for approval letters
   */
  private readonly ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]

  /**
   * Allowed document file extensions
   */
  private readonly ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx']

  /**
   * Maximum file sizes in bytes
   */
  private readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
  private readonly MAX_DOCUMENT_SIZE = 25 * 1024 * 1024 // 25MB

  /**
   * Upload a CAC document image
   */
  public async uploadCACDocument(
    file: MultipartFileContract,
    userId: string
  ): Promise<UploadedFile> {
    this.validateImageFile(file)
    return this.uploadFile(file, `cac-documents/${userId}`)
  }

  /**
   * Upload multiple CAC document images
   */
  public async uploadCACDocuments(
    files: MultipartFileContract[],
    userId: string
  ): Promise<UploadedFile[]> {
    const uploadedFiles: UploadedFile[] = []

    for (const file of files) {
      const uploadedFile = await this.uploadCACDocument(file, userId)
      uploadedFiles.push(uploadedFile)
    }

    return uploadedFiles
  }

  /**
   * Upload shareholders approval letter (PDF or Word)
   */
  public async uploadShareholdersLetter(
    file: MultipartFileContract,
    userId: string
  ): Promise<UploadedFile> {
    this.validateDocumentFile(file)
    return this.uploadFile(file, `approval-letters/${userId}`)
  }

  /**
   * Validate image file — check both MIME type and file extension
   * Supports common variations in how different clients send MIME types
   */
  private validateImageFile(file: MultipartFileContract): void {
    if (!file.isValid) {
      throw new Error(`Invalid file: ${file.errors[0]?.message || 'Unknown error'}`)
    }

    // Check MIME type (case-insensitive)
    const mimeType = (file.type || '').toLowerCase()
    const isValidMimeType = this.ALLOWED_IMAGE_TYPES.some(
      (type) => type.toLowerCase() === mimeType
    )

    // Check file extension as fallback
    const extname = file.extname?.toLowerCase() || ''
    const isValidExtension = this.ALLOWED_IMAGE_EXTENSIONS.some(
      (ext) => ext === extname.replace(/^\./, '')
    )

    if (!isValidMimeType && !isValidExtension) {
      throw new Error(
        `Invalid file type for CAC document. MIME type: ${file.type}, Extension: ${extname}. Allowed types: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`
      )
    }

    if (file.size! > this.MAX_IMAGE_SIZE) {
      throw new Error(
        `CAC document is too large. Maximum size: ${this.MAX_IMAGE_SIZE / (1024 * 1024)}MB`
      )
    }
  }

  /**
   * Validate document file — check both MIME type and file extension
   */
  private validateDocumentFile(file: MultipartFileContract): void {
    if (!file.isValid) {
      throw new Error(`Invalid file: ${file.errors[0]?.message || 'Unknown error'}`)
    }

    // Check MIME type (case-insensitive)
    const mimeType = (file.type || '').toLowerCase()
    const isValidMimeType = this.ALLOWED_DOCUMENT_TYPES.some(
      (type) => type.toLowerCase() === mimeType
    )

    // Check file extension as fallback
    const extname = file.extname?.toLowerCase() || ''
    const isValidExtension = this.ALLOWED_DOCUMENT_EXTENSIONS.some(
      (ext) => ext === extname.replace(/^\./, '')
    )

    if (!isValidMimeType && !isValidExtension) {
      throw new Error(
        `Invalid file type for approval letter. MIME type: ${file.type}, Extension: ${extname}. Allowed types: PDF, Word (.doc, .docx)`
      )
    }

    if (file.size! > this.MAX_DOCUMENT_SIZE) {
      throw new Error(
        `Approval letter is too large. Maximum size: ${this.MAX_DOCUMENT_SIZE / (1024 * 1024)}MB`
      )
    }
  }

  /**
   * Upload a profile image to Cloudinary.
   */
  public async uploadProfileImage(
    file: MultipartFileContract,
    userId: string
  ): Promise<UploadedFile> {
    this.validateImageFile(file)
    return this.uploadFile(file, `profile-images/${userId}`)
  }

  /**
   * Upload file to storage
   */
  private async uploadFile(
    file: MultipartFileContract,
    directory: string
  ): Promise<UploadedFile> {
    try {
      if (!file.tmpPath) {
        throw new Error('Upload file is missing a temporary path')
      }

      const uploadResult = await cloudinary.uploader.upload(file.tmpPath, {
        folder: `wt-payments/${directory}`,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        access_mode: 'public',
      })

      return {
        filename: file.clientName || uploadResult.original_filename || 'uploaded-file',
        path: uploadResult.public_id,
        url: uploadResult.secure_url,
        size: uploadResult.bytes || file.size || 0,
        mimeType: uploadResult.resource_type === 'image' ? uploadResult.format : file.type || uploadResult.resource_type,
      }
    } catch (error: any) {
      throw new Error(`Failed to upload file: ${error.message || error}`)
    }
  }

  /**
   * Delete a file from Cloudinary by public id.
   */
  public async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' })
    } catch (error) {
      console.error(`Failed to delete file ${publicId}:`, error)
    }
  }

  /**
   * Delete multiple files.
   */
  public async deleteFiles(publicIds: string[]): Promise<void> {
    for (const publicId of publicIds) {
      await this.deleteFile(publicId)
    }
  }
}
