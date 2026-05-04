import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

function renderSidebar(collapsed = false) {
  const onToggle = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={['/launch']}>{children}</MemoryRouter>
  );
  return {
    onToggle,
    ...render(<Sidebar collapsed={collapsed} onToggle={onToggle} />, { wrapper }),
  };
}

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    renderSidebar();
    expect(screen.getByText('Launch')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Servers')).toBeInTheDocument();
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Benchmark')).toBeInTheDocument();
    expect(screen.getByText('Daemon')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders Cpu icon as logo', () => {
    renderSidebar();
    // Cpu is rendered as an SVG from lucide-react
    const cpuSvg = document.querySelector('svg');
    expect(cpuSvg).toBeInTheDocument();
  });

  it('highlights active nav item', () => {
    renderSidebar();
    const launchLink = screen.getByText('Launch').closest('a');
    expect(launchLink).toHaveClass('bg-primary');
  });

  it('toggles collapse when collapse button clicked', () => {
    const { onToggle } = renderSidebar();
    const collapseBtn = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(collapseBtn);
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows version number when expanded', () => {
    renderSidebar();
    expect(screen.getByText('v0.1.1')).toBeInTheDocument();
  });

  it('hides version number when collapsed', () => {
    const { container } = renderSidebar(true);
    // Version text should not be in the document when collapsed
    expect(screen.queryByText('v0.1.1')).not.toBeInTheDocument();
  });

  it('renders mobile menu button', () => {
    renderSidebar();
    const menuBtn = screen.getByLabelText('Open menu');
    expect(menuBtn).toBeInTheDocument();
  });

  it('has correct aria-labels for accessibility', () => {
    renderSidebar();
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
  });
});
