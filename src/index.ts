import { findWorkspaces } from 'find-workspaces'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resolve as resolveExports } from 'resolve.exports'
import { type Plugin } from 'vite'

export type UnpkgConfig = {
  mode: string
  root: string
}

export const unpkg = (config: UnpkgConfig) => {
  const { mode, root } = config

  const workspaces = findWorkspaces('..')

  // Extract package names from workspaces
  const workspacePackageNames = workspaces ? workspaces.map(ws => ws.package.name).filter(Boolean) : []

  const isWorkspacePackage = (packageName: string) => workspacePackageNames.includes(packageName)

  const plugun: Plugin = {
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
          console.log('isWorkspacePackage', packageName)
          // Find the workspace for this package
          const workspace = workspaces?.find(ws => ws.package.name === packageName)
          if (workspace) {
            try {
              const resolved = resolveExports(workspace.package, subpath)
              if (resolved && resolved.length > 0) {
                const filePath = resolve(workspace.location, resolved[0])
                const content = readFileSync(filePath, 'utf-8')
                res.setHeader('Content-Type', 'application/javascript')
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

// export default defineConfig(({ mode }) => ({
//   publicDir: 'public',
//   plugins: [cloudflare(), unpkg({ mode, root: __dirname })],
// }))
