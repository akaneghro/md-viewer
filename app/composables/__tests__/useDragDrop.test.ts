import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhysicalPosition } from '@tauri-apps/api/dpi'

import { useDragDrop } from '~/composables/useDragDrop'

const position = new PhysicalPosition(0, 0)

describe('useDragDrop', () => {
  const onFile = vi.fn()
  const onUnsupported = vi.fn()
  let dragDrop: ReturnType<typeof useDragDrop>

  beforeEach(() => {
    vi.clearAllMocks()
    dragDrop = useDragDrop({ onFile, onUnsupported })
  })

  it('should start not dragging', () => {
    expect(dragDrop.isDragging.value).toBe(false)
  })

  it('should show the overlay on enter and over', async () => {
    await dragDrop.handleDragDrop({ type: 'enter', paths: ['/a.md'], position })
    expect(dragDrop.isDragging.value).toBe(true)

    await dragDrop.handleDragDrop({ type: 'over', position })
    expect(dragDrop.isDragging.value).toBe(true)
  })

  it('should hide the overlay on leave', async () => {
    await dragDrop.handleDragDrop({ type: 'enter', paths: ['/a.md'], position })
    await dragDrop.handleDragDrop({ type: 'leave' })
    expect(dragDrop.isDragging.value).toBe(false)
    expect(onFile).not.toHaveBeenCalled()
    expect(onUnsupported).not.toHaveBeenCalled()
  })

  it('should open a dropped markdown file and hide the overlay', async () => {
    await dragDrop.handleDragDrop({ type: 'enter', paths: ['C:\\docs\\README.MD'], position })
    await dragDrop.handleDragDrop({ type: 'drop', paths: ['C:\\docs\\README.MD'], position })
    expect(dragDrop.isDragging.value).toBe(false)
    expect(onFile).toHaveBeenCalledWith('C:\\docs\\README.MD')
  })

  it.each(['notes.markdown', 'notes.mdown', 'notes.mkd'])('should accept %s', async (path) => {
    await dragDrop.handleDragDrop({ type: 'drop', paths: [path], position })
    expect(onFile).toHaveBeenCalledWith(path)
  })

  it('should pick the first markdown file among several', async () => {
    await dragDrop.handleDragDrop({
      type: 'drop',
      paths: ['/img.png', '/first.md', '/second.md'],
      position,
    })
    expect(onFile).toHaveBeenCalledTimes(1)
    expect(onFile).toHaveBeenCalledWith('/first.md')
  })

  it('should report unsupported drops', async () => {
    await dragDrop.handleDragDrop({ type: 'drop', paths: ['/doc.txt', '/folder'], position })
    expect(onFile).not.toHaveBeenCalled()
    expect(onUnsupported).toHaveBeenCalledTimes(1)
  })

  it('should wait for the open handler', async () => {
    let resolved = false
    onFile.mockImplementation(async () => {
      await Promise.resolve()
      resolved = true
    })
    await dragDrop.handleDragDrop({ type: 'drop', paths: ['/a.md'], position })
    expect(resolved).toBe(true)
  })
})
