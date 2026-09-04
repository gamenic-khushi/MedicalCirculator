// Isolated VTK.js feasibility test: load the same real coronary model the
// main app uses (converted to STL, since VTK.js has no glTF/FBX reader) and
// render it, then log the underlying polydata so we can see whether Claude
// has direct programmatic access to points/geometry for automatic
// measurement (the goal of this feasibility test), without touching the
// production three.js viewer at all.
import 'vtk.js/Sources/Rendering/Profiles/Geometry'
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow'
import vtkSTLReader from 'vtk.js/Sources/IO/Geometry/STLReader'
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor'
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper'
import vtkSphereSource from 'vtk.js/Sources/Filters/Sources/SphereSource'

import { measureLesionAutomatically } from './autoLesionMeasurement.js'

const info = document.getElementById('info')

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({ background: [0.12, 0.12, 0.12] })
const renderer = fullScreenRenderer.getRenderer()
const renderWindow = fullScreenRenderer.getRenderWindow()

const reader = vtkSTLReader.newInstance()

function addMarker(position, color, radius) {
  const sphere = vtkSphereSource.newInstance({ center: position, radius, thetaResolution: 16, phiResolution: 16 })
  const mapper = vtkMapper.newInstance()
  mapper.setInputConnection(sphere.getOutputPort())
  const actor = vtkActor.newInstance()
  actor.setMapper(mapper)
  actor.getProperty().setColor(...color)
  renderer.addActor(actor)
  return actor
}

reader
  .setUrl('./model.stl', { binary: true })
  .then(() => {
    const polyData = reader.getOutputData(0)
    const points = polyData.getPoints()
    const numPoints = points.getNumberOfPoints()
    const numCells = polyData.getPolys().getNumberOfCells()
    const bounds = polyData.getBounds()
    const diag = Math.hypot(bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4])

    const mapper = vtkMapper.newInstance()
    mapper.setInputData(polyData)

    const actor = vtkActor.newInstance()
    actor.setMapper(mapper)
    actor.getProperty().setOpacity(0.55)
    renderer.addActor(actor)

    console.log('VTK.js feasibility test loaded:', { numPoints, numCells, bounds })

    const result = measureLesionAutomatically(polyData)
    window.__vtk = { polyData, points, reader, renderer, renderWindow, result }

    if (!result.ok) {
      info.textContent = `Loaded model.stl (${numPoints.toLocaleString()} points) but automatic measurement failed:\n${result.reason}`
      renderer.resetCamera()
      renderWindow.render()
      return
    }

    // Small markers along the auto-traced path so the pick can be checked
    // visually: gray dots for the scan path, green/blue for the
    // proximal/distal ends, red for the detected narrowest point.
    const dotRadius = diag * 0.008
    result.path.forEach((p) => addMarker(p, [0.6, 0.6, 0.6], dotRadius))
    addMarker(result.proximal, [0.2, 0.9, 0.3], dotRadius * 2.2)
    addMarker(result.distal, [0.3, 0.5, 1], dotRadius * 2.2)
    addMarker(result.narrowestPoint, [1, 0.2, 0.2], dotRadius * 2.5)

    renderer.resetCamera()
    renderWindow.render()

    info.textContent = [
      'model.stl loaded via vtk.js STLReader',
      `points: ${numPoints.toLocaleString()}  triangles: ${numCells.toLocaleString()}`,
      '',
      '-- automatic lesion measurement (rough estimate) --',
      `proximal diameter:  ${result.proximalWidth.toFixed(1)}`,
      `distal diameter:    ${result.distalWidth.toFixed(1)}`,
      `narrowest diameter: ${result.narrowestWidth.toFixed(1)}`,
      `stenosis rate:      ${result.stenosisRate.toFixed(0)} %`,
      `MLD:                ${result.mld.toFixed(1)}`,
      `MLA:                ${result.mla.toFixed(1)}`,
      `segment length:     ${result.segmentLength.toFixed(1)}`,
      `lesion position:    ${result.lesionPosition}`,
      '',
      'green=proximal  blue=distal  red=narrowest point',
      'window.__vtk exposed for console experiments',
    ].join('\n')

    console.log('Automatic lesion measurement result:', result)
  })
  .catch((error) => {
    info.textContent = `Failed to load model.stl:\n${error.message}`
    console.error(error)
  })
