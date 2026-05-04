import { cn } from './cn';

describe('cn', () => {
  it('returns a single class string', () => {
    expect(cn('px-4 py-2')).toBe('px-4 py-2');
  });

  it('merges multiple class strings', () => {
    expect(cn('px-4', 'py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('resolves falsy values', () => {
    expect(cn('foo', false, undefined, null, '', 0)).toBe('foo');
  });

  it('resolves conditional classes', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');

    const inactive = false;
    expect(cn('base', inactive && 'active')).toBe('base');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('merges spacing conflicts correctly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('px-2 py-4', 'px-4 py-2')).toBe('px-4 py-2');
  });

  it('handles clsx object syntax', () => {
    expect(cn({ 'bg-red': true, 'bg-blue': false })).toBe('bg-red');
  });

  it('combines with className prop override', () => {
    expect(cn('base-class', 'override-class')).toContain('override-class');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('', null, undefined)).toBe('');
  });

  it('resolves array of classes', () => {
    expect(cn(['text-sm', 'font-bold'], 'mt-2')).toBe('text-sm font-bold mt-2');
  });
});
