import { describe, it, expect } from 'vitest';
import { applyTemplate, stripMarkdown } from './exportUtils.js';

describe('applyTemplate', () => {
  it('substitutes a single variable', () => {
    expect(applyTemplate('Hello {{name}}', { name: 'John' })).toBe('Hello John');
  });

  it('substitutes multiple variables', () => {
    const result = applyTemplate('{{a}} and {{b}}', { a: 'foo', b: 'bar' });
    expect(result).toBe('foo and bar');
  });

  it('substitutes the same variable appearing multiple times', () => {
    const result = applyTemplate('{{x}} + {{x}}', { x: '5' });
    expect(result).toBe('5 + 5');
  });

  it('leaves unknown variables untouched', () => {
    const result = applyTemplate('Hello {{unknown}}', { name: 'John' });
    expect(result).toBe('Hello {{unknown}}');
  });

  it('converts null values to empty string', () => {
    const result = applyTemplate('{{val}}', { val: null });
    expect(result).toBe('');
  });

  it('converts undefined values to empty string', () => {
    const result = applyTemplate('{{val}}', { val: undefined });
    expect(result).toBe('');
  });

  it('converts numeric values to string', () => {
    const result = applyTemplate('Count: {{n}}', { n: 42 });
    expect(result).toBe('Count: 42');
  });

  it('returns template unchanged when vars is empty', () => {
    expect(applyTemplate('No vars here', {})).toBe('No vars here');
  });
});

describe('stripMarkdown', () => {
  it('removes bold markers', () => {
    expect(stripMarkdown('**bold**')).toBe('bold');
  });

  it('removes italic markers', () => {
    expect(stripMarkdown('*italic*')).toBe('italic');
  });

  it('removes heading markers', () => {
    expect(stripMarkdown('# Heading')).toBe('Heading');
    expect(stripMarkdown('## Sub')).toBe('Sub');
    expect(stripMarkdown('### Deep')).toBe('Deep');
  });

  it('converts --- to ----------', () => {
    expect(stripMarkdown('---')).toBe('----------');
  });

  it('preserves --- conversion when surrounded by newlines', () => {
    const input = 'above\n---\nbelow';
    const result = stripMarkdown(input);
    expect(result).toContain('----------');
    // '---' alone (not as part of '----------') should be gone
    expect(result).not.toMatch(/(?<!-)---(?!-)/);
  });

  it('does not convert --- that is part of a longer string', () => {
    // A line like "---extra" should not become a separator
    const result = stripMarkdown('---extra');
    expect(result).not.toBe('----------extra');
  });

  it('passes through plain text unchanged (aside from whitespace normalisation)', () => {
    const result = stripMarkdown('just plain text');
    expect(result).toBe('just plain text');
  });
});
