import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : []
  })
}
test('all shared frontend and build imports are declared direct dependencies', () => {
  const declared = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }))
  const missing = new Set()
  for (const file of [...files(path.join(root, 'src')), path.join(root, 'vite.config.ts')]) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    function visit(node) {
      let specifier
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) specifier = node.arguments[0]
      if (specifier && ts.isStringLiteral(specifier)) {
        const name = specifier.text
        if (!name.startsWith('.') && !isBuiltin(name)) {
          const packageName = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]
          if (!declared.has(packageName)) missing.add(packageName)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.deepEqual([...missing].sort(), [], 'Declare imported packages; never rely on extraneous node_modules')
})
test('numeric Node versions are not npm application dependencies', () => {
  assert.equal(manifest.dependencies['20'], undefined)
  assert.equal(manifest.dependencies['22'], undefined)
})
