// Reused model files are trusted by filename alone (record.file, stored
// metadata) — if that ever drifts from what was actually uploaded under the
// modelFileId it points to (e.g. a row's metadata got repointed to a
// different upload without updating modelFileId, or vice versa), the wrong
// loader gets picked and fails deep inside a third-party parser with an
// error that gives no hint the real problem is a filename/content mismatch.
// Sniffing the actual bytes catches that before it reaches a loader at all.
//
// Only STL, glTF/GLB and binary FBX have signatures reliable enough to
// trust over the filename. ASCII FBX and OBJ are both plain text with no
// fixed header, so a mismatch there falls through to the filename-derived
// extension unchanged, same as before this existed.
export function sniffModelExtension(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength < 4) return null
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 64))
  const asAscii = String.fromCharCode(...bytes)

  // glTF binary: magic uint32 0x46546C67 ("glTF") at byte 0.
  const view = new DataView(buffer)
  if (buffer.byteLength >= 4 && view.getUint32(0, true) === 0x46546c67) return 'glb'

  // Binary FBX: literal "Kaydara FBX Binary" near the start.
  if (asAscii.startsWith('Kaydara FBX Binary')) return 'fbx'

  // ASCII STL: starts with "solid" (case-insensitive), on its own or
  // followed by a name/whitespace — this is the one common STL variant with
  // an actual required prefix.
  if (/^solid\s/i.test(asAscii) || asAscii.trim().toLowerCase() === 'solid') return 'stl'

  // Binary STL has no required magic — real-world exporters put whatever
  // they like in the 80-byte header, including plain readable text (this
  // file's header is "MESHMIXER-STL-BINARY-FORMAT" padded with literal
  // dashes, not nulls, so a printable-byte check on the header can't tell
  // it apart from a text file). What's actually fixed by the format is the
  // triangle count at byte 80 (uint32 LE): a genuine binary STL's total
  // size always equals 84 + triangleCount * 50 exactly, which a
  // coincidentally-sized non-STL file won't satisfy.
  if (buffer.byteLength >= 84) {
    const triangleCount = view.getUint32(80, true)
    if (84 + triangleCount * 50 === buffer.byteLength) return 'stl'
  }

  return null
}
