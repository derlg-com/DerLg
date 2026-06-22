import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownText } from '@/components/shared/MarkdownText'

describe('MarkdownText', () => {
  it('renders **bold** segments as <strong>', () => {
    const { container } = render(<MarkdownText text="Stay at the **Sokha Hotel** tonight" />)
    const strong = container.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong!.textContent).toBe('Sokha Hotel')
    expect(screen.getByText(/Stay at the/)).toBeInTheDocument()
  })

  it('renders plain text without strong', () => {
    const { container } = render(<MarkdownText text="No markdown here" />)
    expect(container.querySelector('strong')).toBeNull()
    expect(screen.getByText('No markdown here')).toBeInTheDocument()
  })

  it('does not inject HTML (renders tags as text)', () => {
    const { container } = render(<MarkdownText text="<img src=x onerror=alert(1)>" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('keeps line breaks', () => {
    const { container } = render(<MarkdownText text={'line one\nline two'} />)
    expect(container.querySelectorAll('br').length).toBe(1)
  })
})
