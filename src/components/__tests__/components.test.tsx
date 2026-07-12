import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { Icon } from '../Icon'
import { Panel } from '../Panel'
import { Spinner } from '../Spinner'

afterEach(cleanup)

describe('Button', () => {
  test('busy disables the button and blocks clicks', () => {
    const onClick = vi.fn()
    render(
      <Button busy onClick={onClick}>
        导出
      </Button>,
    )
    const btn = screen.getByRole('button', { name: /导出/ })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  test('variant maps to distinct styling', () => {
    render(<Button variant="danger">删除</Button>)
    expect(screen.getByRole('button', { name: '删除' }).className).toContain('red')
  })
})

describe('Chip', () => {
  test('selected chip exposes aria-pressed and primary styling', () => {
    render(<Chip selected>PNG</Chip>)
    const chip = screen.getByRole('button', { name: 'PNG' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chip.className).toContain('primary')
  })

  test('unselected chip is aria-pressed=false', () => {
    render(<Chip>JPEG</Chip>)
    expect(screen.getByRole('button', { name: 'JPEG' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Icon', () => {
  test('renders an svg for a known name and is aria-hidden by default', () => {
    const { container } = render(<Icon name="scissors" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Panel', () => {
  test('renders title as a heading with children', () => {
    render(
      <Panel title="导出">
        <p>内容</p>
      </Panel>,
    )
    expect(screen.getByRole('heading', { name: '导出' })).toBeInTheDocument()
    expect(screen.getByText('内容')).toBeInTheDocument()
  })
})

describe('Spinner', () => {
  test('renders a status indicator', () => {
    render(<Spinner label="处理中" />)
    expect(screen.getByRole('status', { name: '处理中' })).toBeInTheDocument()
  })
})
