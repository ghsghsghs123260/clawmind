import { describe, it, expect } from 'vitest';
import { validateSkill, parseSkillJSON, parseSkillMarkdown, loadSkillFromFile } from '../../skills/parser.js';
import path from 'path';

describe('validateSkill', () => {
  it('validates a correct skill', () => {
    const skill = {
      name: 'test',
      description: 'A test skill',
      trigger: { keywords: ['test'], patterns: [] },
      actions: [{ step: 1, action: 'file.read', params: {} }],
    };
    const result = validateSkill(skill);
    expect(result.valid).toBe(true);
  });

  it('rejects skill missing name', () => {
    const skill = {
      description: 'No name',
      trigger: { keywords: ['test'] },
      actions: [{ step: 1, action: 'file.read', params: {} }],
    };
    const result = validateSkill(skill);
    expect(result.valid).toBe(false);
  });

  it('rejects skill missing trigger', () => {
    const skill = {
      name: 'test',
      description: 'No trigger',
      actions: [{ step: 1, action: 'file.read', params: {} }],
    };
    const result = validateSkill(skill);
    expect(result.valid).toBe(false);
  });

  it('rejects skill missing actions', () => {
    const skill = {
      name: 'test',
      description: 'No actions',
      trigger: { keywords: ['test'] },
    };
    const result = validateSkill(skill);
    expect(result.valid).toBe(false);
  });
});

describe('parseSkillJSON', () => {
  it('parses valid JSON skill', () => {
    const json = JSON.stringify({
      name: 'test',
      description: 'Test skill',
      trigger: { keywords: ['test'], patterns: [] },
      parameters: [],
      actions: [{ step: 1, action: 'file.read', params: {} }],
    });
    const skill = parseSkillJSON(json);
    expect(skill.name).toBe('test');
    expect(skill.trigger.keywords).toEqual(['test']);
  });
});

describe('parseSkillMarkdown', () => {
  it('parses markdown skill with section headers', () => {
    const md = `# Search Web

## Description

Search the web using a search engine and return results.

## Trigger

- **Keywords:** search, google, find, lookup
- **Pattern:** \`search for {query}\`
- **Pattern:** \`google {query}\`

## Parameters

- **query** (string, required): The search query
- **count** (number, optional, default: 5): Number of results

## Actions

### Step 1: Open search page
- **Action:** browser.open
- **URL:** \`https://google.com/search?q={{query}}\`

### Step 2: Wait for results
- **Action:** browser.wait_for
- **Selector:** \`#search\`
- **Timeout:** 5000
`;
    const skill = parseSkillMarkdown(md);
    expect(skill.name).toBe('Search Web');
    expect(skill.trigger.keywords).toContain('search');
    expect(skill.actions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('loadSkillFromFile', () => {
  it('loads a JSON skill file', () => {
    const filePath = path.join(__dirname, '../../skills/builtin/file_search.json');
    const skill = loadSkillFromFile(filePath);
    expect(skill.name).toBe('file_search');
    expect(skill.trigger.keywords.length).toBeGreaterThan(0);
    expect(skill.actions.length).toBeGreaterThan(0);
  });

  it('loads a Markdown skill file', () => {
    const filePath = path.join(__dirname, '../../skills/builtin/search_web.md');
    const skill = loadSkillFromFile(filePath);
    expect(skill.name).toBeDefined();
    expect(skill.trigger.keywords.length).toBeGreaterThan(0);
  });
});
