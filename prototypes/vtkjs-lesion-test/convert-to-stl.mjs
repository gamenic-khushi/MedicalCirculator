// One-off conversion: FBX -> STL, so VTK.js (which has no FBX/glTF reader)
// can load a real model for the vtk.js feasibility test.
// Usage: node convert-to-stl.mjs [path/to/model.fbx]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// FBXLoader touches `window.URL` and the DOM Image/canvas pipeline while
// parsing embedded textures even though we only need geometry — stub/short-
// circuit just enough to satisfy it in Node.
globalThis.window = { URL: { createObjectURL: () => 'about:blank', revokeObjectURL: () => {} } }

import * as THREE from 'three'
import { FBXLoader, STLExporter } from 'three-stdlib'

THREE.TextureLoader.prototype.load = function load(_url, onLoad) {
  const texture = new THREE.Texture()
  if (onLoad) onLoad(texture)
  return texture
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../../src/assets/image/Coronary Artery heart.fbx')
const outPath = path.resolve(__dirname, 'model.stl')

const buffer = readFileSync(srcPath)
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

const loader = new FBXLoader()
const object = loader.parse(arrayBuffer, '')
const exporter = new STLExporter()
const stlBinary = exporter.parse(object, { binary: true })
writeFileSync(outPath, Buffer.from(stlBinary.buffer, stlBinary.byteOffset, stlBinary.byteLength))
console.log(`Wrote ${outPath} (${stlBinary.byteLength} bytes)`)
