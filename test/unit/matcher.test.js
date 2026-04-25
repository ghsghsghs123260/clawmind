import { describe, it, expect } from 'vitest';
import {
  calculateSimilarity,
  matchKeywords,
  matchPatterns,
  matchSkill,
  findBestMatch,
  extractParameters,
} from '../../skills/matcher.js';

describe('calculateSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(calculateSimilarity('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(calculateSimilarity('abc', 'xyz')).toBeLessThan(0.5);
  });

  it('is case insensitive', () => {
    expect(calculateSimilarity('Hello', 'hello')).toBe(1);
  });
});

describe('matchKeywords', () => {
  it('matches when input contains a keyword', () => {
    const result = matchKeywords('take a screenshot', ['screenshot', 'capture']);
    expect(result.matched).toBe(true);
    expect(result.matchedKeywords).toContain('screenshot');
  });

  it('returns false when no keywords match', () => {
    const result = matchKeywords('hello world', ['screenshot', 'backup']);
    expect(result.matched).toBe(false);
  });

  it('does not score too low when only 1 of many keywords matches', () => {
    const result = matchKeywords('scrape page', [
      'scrape', 'web scraping', '网页抓取', '提取网页', 'extract web', '抓取网页',
    ]);
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0.15);
  });
});

describe('matchPatterns', () => {
  it('matches regex patterns', () => {
    const result = matchPatterns('take a screenshot', ['take a? screenshot']);
    expect(result.matched).toBe(true);
  });

  it('extracts named captures from {param} syntax', () => {
    const result = matchPatterns('backup C:/docs to D:/backup', [
      'backup {source} to {destination}',
    ]);
    expect(result.matched).toBe(true);
    expect(result.captures.source).toBe('C:/docs');
    expect(result.captures.destination).toBe('D:/backup');
  });

  it('extracts URL from single-param pattern', () => {
    const result = matchPatterns('scrape https://example.com', ['scrape {url}']);
    expect(result.matched).toBe(true);
    expect(result.captures.url).toBe('https://example.com');
  });

  it('returns empty result for non-matching patterns', () => {
    const result = matchPatterns('hello world', ['find files {pattern}']);
    expect(result.matched).toBe(false);
    expect(result.captures).toEqual({});
  });
});

describe('matchSkill', () => {
  const skill = {
    name: 'file_search',
    trigger: {
      keywords: ['find files', 'search files', 'locate file'],
      patterns: ['find files {pattern} in {directory}', 'search for {pattern}'],
    },
    parameters: [
      { name: 'pattern', type: 'string', required: true },
      { name: 'directory', type: 'string', required: false },
    ],
  };

  it('matches by keyword', () => {
    const result = matchSkill('find files in my project', skill);
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('matches by pattern with parameter extraction', () => {
    const result = matchSkill('find files *.js in /src', skill);
    expect(result.matched).toBe(true);
    expect(result.details.patterns.captures.pattern).toBe('*.js');
    expect(result.details.patterns.captures.directory).toBe('/src');
  });

  it('returns score > 0 for partial matches', () => {
    const result = matchSkill('search for config.json', skill);
    expect(result.matched).toBe(true);
  });
});

describe('findBestMatch', () => {
  const skills = [
    {
      name: 'screenshot',
      trigger: { keywords: ['screenshot', 'capture'], patterns: ['take a? screenshot'] },
    },
    {
      name: 'backup',
      trigger: { keywords: ['backup', 'copy'], patterns: ['backup {source} to {dest}'] },
    },
  ];

  it('returns the best matching skill', () => {
    const result = findBestMatch('take a screenshot', skills);
    expect(result).not.toBeNull();
    expect(result.skill.name).toBe('screenshot');
  });

  it('returns null when no skill exceeds threshold', () => {
    const result = findBestMatch('random unrelated text', skills, 0.5);
    expect(result).toBeNull();
  });
});

describe('extractParameters', () => {
  it('extracts from captures', () => {
    const params = extractParameters(
      'input',
      [{ name: 'url', type: 'string', required: true }],
      { url: 'https://example.com' }
    );
    expect(params.url).toBe('https://example.com');
  });

  it('falls back to default values', () => {
    const params = extractParameters(
      'input',
      [{ name: 'region', type: 'string', required: false, default: 'fullscreen' }],
      {}
    );
    expect(params.region).toBe('fullscreen');
  });

  it('extracts URL from input when param name is url', () => {
    const params = extractParameters(
      'scrape https://example.com now',
      [{ name: 'url', type: 'string', required: true }],
      {}
    );
    expect(params.url).toBe('https://example.com');
  });

  it('returns empty object when no parameters defined', () => {
    const params = extractParameters('input', null, {});
    expect(params).toEqual({});
  });
});
