import { describe, it, expect, vi } from 'vitest';
import SkillExecutor from '../../skills/executor.js';

describe('SkillExecutor', () => {
  function createExecutor(actionResults = {}) {
    const mockActionExecutor = vi.fn(async (action, params) => {
      if (actionResults[action]) return actionResults[action];
      return { success: true, action, params };
    });
    return new SkillExecutor(mockActionExecutor);
  }

  const basicSkill = {
    name: 'test_skill',
    parameters: [
      { name: 'target', type: 'string', required: true },
      { name: 'verbose', type: 'boolean', required: false },
    ],
    actions: [
      { step: 1, action: 'file.search', params: { pattern: '{{target}}' } },
      { step: 2, action: 'notification.send', params: { message: 'Found results for {{target}}' } },
    ],
  };

  it('executes all actions in a skill', async () => {
    const executor = createExecutor();
    const result = await executor.executeSkill(basicSkill, { target: '*.js' });

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].action).toBe('file.search');
    expect(result.results[1].action).toBe('notification.send');
  });

  it('resolves {{param}} placeholders', async () => {
    const executor = createExecutor();
    await executor.executeSkill(basicSkill, { target: '*.js' });

    expect(executor.actionExecutor).toHaveBeenCalledWith(
      'file.search',
      { pattern: '*.js' },
      expect.any(Object)
    );
  });

  it('resolves {{stepN.result.xxx}} references', async () => {
    const skill = {
      name: 'chain',
      parameters: [],
      actions: [
        { step: 1, action: 'step.one', params: {} },
        { step: 2, action: 'step.two', params: { data: '{{step1.result.path}}' } },
      ],
    };

    const executor = createExecutor({
      'step.one': { path: '/tmp/output.txt' },
    });

    await executor.executeSkill(skill, {});

    // Second call should have resolved param
    const secondCall = executor.actionExecutor.mock.calls[1];
    expect(secondCall[1].data).toBe('/tmp/output.txt');
  });

  it('fails when required parameter is missing', async () => {
    const executor = createExecutor();
    const result = await executor.executeSkill(basicSkill, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameters');
    expect(result.error).toContain('target');
  });

  it('records execution history', async () => {
    const executor = createExecutor();
    await executor.executeSkill(basicSkill, { target: 'test' });

    const history = executor.getExecutionHistory(1);
    expect(history).toHaveLength(1);
    expect(history[0].skill).toBe('test_skill');
    expect(history[0].status).toBe('completed');
  });

  it('stops on action failure by default', async () => {
    const failingExecutor = new SkillExecutor(vi.fn(async (action) => {
      if (action === 'file.search') throw new Error('search failed');
      return { success: true };
    }));

    const result = await failingExecutor.executeSkill(basicSkill, { target: 'x' });
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
  });

  it('continues on failure when stopOnError is false', async () => {
    const failingExecutor = new SkillExecutor(vi.fn(async (action) => {
      if (action === 'file.search') throw new Error('failed');
      return { success: true };
    }));

    const result = await failingExecutor.executeSkill(basicSkill, { target: 'x' }, { stopOnError: false });
    expect(result.results).toHaveLength(2);
  });
});
