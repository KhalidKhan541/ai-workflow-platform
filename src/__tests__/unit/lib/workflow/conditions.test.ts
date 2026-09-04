import { ConditionEvaluator, Condition } from '@/lib/workflow/conditions';

describe('ConditionEvaluator', () => {
  let evaluator: ConditionEvaluator;

  beforeEach(() => {
    evaluator = new ConditionEvaluator();
  });

  describe('comparison operators', () => {
    const context = { age: 25, name: 'Alice', score: 95.5, active: true };

    it('should evaluate eq', () => {
      expect(evaluator.evaluate({ field: 'age', operator: 'eq', value: 25 }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'age', operator: 'eq', value: 30 }, context)).toBe(false);
    });

    it('should evaluate neq', () => {
      expect(evaluator.evaluate({ field: 'age', operator: 'neq', value: 30 }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'age', operator: 'neq', value: 25 }, context)).toBe(false);
    });

    it('should evaluate gt', () => {
      expect(evaluator.evaluate({ field: 'age', operator: 'gt', value: 20 }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'age', operator: 'gt', value: 25 }, context)).toBe(false);
      expect(evaluator.evaluate({ field: 'age', operator: 'gt', value: 30 }, context)).toBe(false);
    });

    it('should evaluate gte', () => {
      expect(evaluator.evaluate({ field: 'age', operator: 'gte', value: 25 }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'age', operator: 'gte', value: 26 }, context)).toBe(false);
    });

    it('should evaluate lt', () => {
      expect(evaluator.evaluate({ field: 'age', operator: 'lt', value: 30 }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'age', operator: 'lt', value: 25 }, context)).toBe(false);
    });

    it('should evaluate lte', () => {
      expect(evaluator.evaluate({ field: 'age', operator: 'lte', value: 25 }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'age', operator: 'lte', value: 24 }, context)).toBe(false);
    });

    it('should evaluate contains on strings', () => {
      expect(evaluator.evaluate({ field: 'name', operator: 'contains', value: 'Ali' }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'name', operator: 'contains', value: 'Bob' }, context)).toBe(false);
    });

    it('should evaluate not_contains on strings', () => {
      expect(evaluator.evaluate({ field: 'name', operator: 'not_contains', value: 'Bob' }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'name', operator: 'not_contains', value: 'Ali' }, context)).toBe(false);
    });

    it('should evaluate starts_with', () => {
      expect(evaluator.evaluate({ field: 'name', operator: 'starts_with', value: 'Ali' }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'name', operator: 'starts_with', value: 'ice' }, context)).toBe(false);
    });

    it('should evaluate ends_with', () => {
      expect(evaluator.evaluate({ field: 'name', operator: 'ends_with', value: 'ice' }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'name', operator: 'ends_with', value: 'Ali' }, context)).toBe(false);
    });

    it('should evaluate matches with regex', () => {
      expect(evaluator.evaluate({ field: 'name', operator: 'matches', value: '^A.*e$' }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'name', operator: 'matches', value: '^B' }, context)).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      expect(evaluator.evaluate({ field: 'name', operator: 'matches', value: '[invalid' }, context)).toBe(false);
    });

    it('should evaluate in array', () => {
      expect(evaluator.evaluate({ field: 'age', operator: 'in', value: [20, 25, 30] }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'age', operator: 'in', value: [20, 30] }, context)).toBe(false);
    });

    it('should evaluate not_in array', () => {
      expect(evaluator.evaluate({ field: 'age', operator: 'not_in', value: [20, 30] }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'age', operator: 'not_in', value: [25, 30] }, context)).toBe(false);
    });
  });

  describe('logical operators', () => {
    const context = { a: 1, b: 2, c: 3 };

    it('should evaluate AND', () => {
      const cond: Condition = {
        operator: 'and',
        conditions: [
          { field: 'a', operator: 'gt', value: 0 },
          { field: 'b', operator: 'gt', value: 1 },
        ],
      };
      expect(evaluator.evaluate(cond, context)).toBe(true);
    });

    it('should evaluate AND with one false', () => {
      const cond: Condition = {
        operator: 'and',
        conditions: [
          { field: 'a', operator: 'gt', value: 0 },
          { field: 'b', operator: 'lt', value: 1 },
        ],
      };
      expect(evaluator.evaluate(cond, context)).toBe(false);
    });

    it('should evaluate OR', () => {
      const cond: Condition = {
        operator: 'or',
        conditions: [
          { field: 'a', operator: 'eq', value: 999 },
          { field: 'b', operator: 'eq', value: 2 },
        ],
      };
      expect(evaluator.evaluate(cond, context)).toBe(true);
    });

    it('should evaluate OR with both false', () => {
      const cond: Condition = {
        operator: 'or',
        conditions: [
          { field: 'a', operator: 'eq', value: 999 },
          { field: 'b', operator: 'eq', value: 999 },
        ],
      };
      expect(evaluator.evaluate(cond, context)).toBe(false);
    });

    it('should evaluate NOT', () => {
      const cond: Condition = {
        operator: 'not',
        conditions: [{ field: 'a', operator: 'eq', value: 999 }],
      };
      expect(evaluator.evaluate(cond, context)).toBe(true);
    });

    it('should evaluate NOT with empty conditions', () => {
      const cond: Condition = { operator: 'not', conditions: [] };
      expect(evaluator.evaluate(cond, context)).toBe(true);
    });
  });

  describe('exists/not_exists', () => {
    const context = { name: 'Alice', age: 25 };

    it('should evaluate exists', () => {
      expect(evaluator.evaluate({ field: 'name', operator: 'exists' } as any, context)).toBe(true);
    });

    it('should evaluate not_exists', () => {
      expect(evaluator.evaluate({ field: 'missing', operator: 'not_exists' } as any, context)).toBe(true);
    });

    it('should evaluate exists for null value', () => {
      const ctx = { name: null };
      expect(evaluator.evaluate({ field: 'name', operator: 'not_exists' } as any, ctx)).toBe(true);
    });

    it('should evaluate exists for undefined value', () => {
      const ctx = {};
      expect(evaluator.evaluate({ field: 'name', operator: 'exists' } as any, ctx)).toBe(false);
    });
  });

  describe('nested field access', () => {
    it('should access nested fields', () => {
      const context = { user: { profile: { age: 30 } } };
      expect(evaluator.evaluate({ field: 'user.profile.age', operator: 'eq', value: 30 }, context)).toBe(true);
    });

    it('should return undefined for missing nested path', () => {
      const context = { user: {} };
      expect(evaluator.evaluate({ field: 'user.profile.age', operator: 'eq', value: 30 }, context)).toBe(false);
    });
  });

  describe('complex nested conditions', () => {
    it('should handle deeply nested conditions', () => {
      const context = { user: { role: 'admin', active: true }, count: 5 };
      const cond: Condition = {
        operator: 'and',
        conditions: [
          { field: 'user.active', operator: 'eq', value: true },
          {
            operator: 'or',
            conditions: [
              { field: 'user.role', operator: 'eq', value: 'admin' },
              { field: 'count', operator: 'gt', value: 10 },
            ],
          },
        ],
      };
      expect(evaluator.evaluate(cond, context)).toBe(true);
    });
  });

  describe('array contains', () => {
    it('should evaluate contains on array', () => {
      const context = { tags: ['a', 'b', 'c'] };
      expect(evaluator.evaluate({ field: 'tags', operator: 'contains', value: 'b' }, context)).toBe(true);
      expect(evaluator.evaluate({ field: 'tags', operator: 'contains', value: 'd' }, context)).toBe(false);
    });

    it('should evaluate not_contains on array', () => {
      const context = { tags: ['a', 'b'] };
      expect(evaluator.evaluate({ field: 'tags', operator: 'not_contains', value: 'c' }, context)).toBe(true);
    });
  });

  describe('static factory methods', () => {
    it('should create comparison condition', () => {
      const cond = ConditionEvaluator.createComparison('age', 'gt', 18);
      expect(cond).toEqual({ field: 'age', operator: 'gt', value: 18 });
    });

    it('should create logical condition', () => {
      const cond = ConditionEvaluator.createLogical('and', [
        { field: 'a', operator: 'eq', value: 1 },
        { field: 'b', operator: 'eq', value: 2 },
      ]);
      expect(cond.operator).toBe('and');
      expect(cond.conditions).toHaveLength(2);
    });

    it('should create exists condition', () => {
      const cond = ConditionEvaluator.createExists('field', 'exists');
      expect(cond).toEqual({ field: 'field', operator: 'exists' });
    });
  });

  describe('non-object context', () => {
    it('should handle null context', () => {
      expect(evaluator.evaluate({ field: 'a', operator: 'eq', value: 1 }, null)).toBe(false);
    });

    it('should handle undefined context', () => {
      expect(evaluator.evaluate({ field: 'a', operator: 'eq', value: 1 }, undefined)).toBe(false);
    });
  });

  describe('unknown operator', () => {
    it('should return false for unknown comparison operator', () => {
      expect(evaluator.evaluate({ field: 'a', operator: 'unknown' as any, value: 1 }, { a: 1 })).toBe(false);
    });

    it('should return false for unknown logical operator', () => {
      const cond = { operator: 'unknown' as any, conditions: [{ field: 'a', operator: 'eq', value: 1 }] };
      expect(evaluator.evaluate(cond, { a: 1 })).toBe(false);
    });
  });
});
