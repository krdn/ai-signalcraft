import { describe, it, expect } from 'vitest';

describe('ADVN 모듈 export 확인', () => {
  it('4개 모듈이 modules/index.ts에서 export된다', async () => {
    const mods = await import('../src/analysis/modules');
    expect(mods.approvalRatingModule).toBeDefined();
    expect(mods.frameWarModule).toBeDefined();
    expect(mods.crisisScenarioModule).toBeDefined();
    expect(mods.winSimulationModule).toBeDefined();
  });

  it('4개 스키마가 schemas/index.ts에서 export된다', async () => {
    const schemas = await import('../src/analysis/schemas');
    expect(schemas.ApprovalRatingSchema).toBeDefined();
    expect(schemas.FrameWarSchema).toBeDefined();
    expect(schemas.CrisisScenarioSchema).toBeDefined();
    expect(schemas.WinSimulationSchema).toBeDefined();
  });

  it('MODULE_MODEL_MAP이 4개 ADVN 모듈 매핑을 포함한다', async () => {
    const { MODULE_MODEL_MAP } = await import('../src/analysis/types');
    const advnModules = ['approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation'];

    for (const mod of advnModules) {
      expect(MODULE_MODEL_MAP[mod]).toBeDefined();
      expect(MODULE_MODEL_MAP[mod].provider).toBe('anthropic');
      expect(MODULE_MODEL_MAP[mod].model).toBe('claude-sonnet-4-6');
    }
  });

  it('MODULE_NAMES에 4개 ADVN 이름 상수가 포함된다', async () => {
    const { MODULE_NAMES } = await import('../src/analysis/types');
    expect(MODULE_NAMES.APPROVAL_RATING).toBe('approval-rating');
    expect(MODULE_NAMES.FRAME_WAR).toBe('frame-war');
    expect(MODULE_NAMES.CRISIS_SCENARIO).toBe('crisis-scenario');
    expect(MODULE_NAMES.WIN_SIMULATION).toBe('win-simulation');
  });
});
