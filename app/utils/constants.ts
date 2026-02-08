/** Valid markdown file extensions (without the leading dot) */
export const VALID_MD_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd'] as const

/** Check if a file path has a valid markdown extension */
export function isValidMarkdownFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase()
  return VALID_MD_EXTENSIONS.includes(ext as typeof VALID_MD_EXTENSIONS[number])
}

/** Maximum file size in bytes (10 MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

/** Maximum file size in MB for display purposes */
export const MAX_FILE_SIZE_MB = 10
