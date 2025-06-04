import { findWorkspaces } from 'find-workspaces'
import { existsSync, readFileSync, statSync } from 'fs'
import { resolve } from 'path'
import { resolve as resolveExports } from 'resolve.exports'

/**
 * @typedef {Object} UnpkgConfig
 * @property {string} mode - The build mode (development/production)
 * @property {string} root - The root directory path
 */

/**
 * Creates a Vite plugin for handling unpkg URLs in development mode
 * @param {UnpkgConfig} config - Configuration object
 * @returns {import('vite').Plugin} Vite plugin object
 */
export const unpkg = config => {
  const { mode, root } = config

  const workspaces = findWorkspaces('..')

  // Extract package names from workspaces
  const workspacePackageNames = workspaces ? workspaces.map(ws => ws.package.name).filter(Boolean) : []

  /**
   * Get MIME type based on file extension
   * @param {string} filePath - File path to get MIME type for
   * @returns {string} MIME type string
   */
  const getMimeType = filePath => {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const mimeTypes = {
      js: 'application/javascript',
      mjs: 'application/javascript',
      jsx: 'application/javascript',
      ts: 'application/javascript',
      tsx: 'application/javascript',
      css: 'text/css',
      json: 'application/json',
      html: 'text/html',
      htm: 'text/html',
      svg: 'image/svg+xml',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      eot: 'application/vnd.ms-fontobject',
      md: 'text/markdown',
      txt: 'text/plain',
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * Check if a package name belongs to a workspace
   * @param {string} packageName - Package name to check
   * @returns {boolean} True if package is in workspace
   */
  const isWorkspacePackage = packageName => workspacePackageNames.includes(packageName)

  /** @type {import('vite').Plugin} */
  const plugun = {
    name: 'unpkg',

    // Transform any imported file that contains unpkg URLs
    transform(code, id) {
      if (mode === 'development' && code.includes('https://unpkg.com')) {
        // Only replace URLs for workspace packages
        return code.replace(/https:\/\/unpkg\.com\/([^\/\s"']+)/g, (match, packageName) => {
          if (isWorkspacePackage(packageName)) {
            return `/@unpkg/${packageName}`
          }
          return match // Don't replace non-workspace packages
        })
      }
      return null
    },
    configureServer(server) {
      if (mode !== 'development') return

      // Handle /@unpkg/<path> requests using resolve.exports
      server.middlewares.use('/@unpkg/', (req, res, next) => {
        const urlPath = req.url?.replace('/@unpkg/', '') || ''
        const [packageName, ...subpathParts] = urlPath.split('/').filter(Boolean)
        const subpath = subpathParts.length > 0 ? `./${subpathParts.join('/')}` : '.'

        if (isWorkspacePackage(packageName)) {
          // Find the workspace for this package
          const workspace = workspaces?.find(ws => ws.package.name === packageName)
          if (workspace) {
            // First try direct file path
            const directFilePath = resolve(workspace.location, subpath)

            if (existsSync(directFilePath) && statSync(directFilePath).isFile()) {
              try {
                const content = readFileSync(directFilePath, 'utf-8')
                res.setHeader('Content-Type', getMimeType(directFilePath))
                res.end(content)
                return
              } catch (error) {
                console.warn(`Failed to read direct file ${subpath}:`, error)
              }
            }

            // Fall back to resolveExports
            try {
              const resolved = resolveExports(workspace.package, subpath)
              if (resolved && resolved.length > 0) {
                const resolvedPath = resolved[0].replace(/^\.\//, '') // Remove leading ./
                const currentPath = subpathParts.join('/')

                // If the resolved path is different from the current path, redirect
                if (resolvedPath !== currentPath) {
                  res.writeHead(302, { Location: `/@unpkg/${packageName}/${resolvedPath}` })
                  res.end()
                  return
                }

                // Otherwise serve the file content
                const filePath = resolve(workspace.location, resolved[0])
                const content = readFileSync(filePath, 'utf-8')
                res.setHeader('Content-Type', getMimeType(filePath))
                res.end(content)
                return
              }
            } catch (error) {
              console.warn(`Failed to resolve ${packageName}${subpath}:`, error)
            }
          }
        }

        next()
      })
    },
  }

  return plugun
}
