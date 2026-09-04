import {
  createUserSchema,
  loginSchema,
  createWorkflowSchema,
  updateWorkflowSchema,
  executeWorkflowSchema,
  paginationSchema,
  integrationConfigSchema,
  webhookSchema,
  aiAgentSchema,
  promptTemplateSchema,
  validateInput,
  emailSchema,
  passwordSchema,
} from '@/lib/validators';

describe('Validators', () => {
  describe('emailSchema', () => {
    it('should accept valid email', () => {
      expect(emailSchema.safeParse('user@example.com').success).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('').success).toBe(false);
      expect(emailSchema.safeParse('user@').success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('should accept strong password', () => {
      expect(passwordSchema.safeParse('Str0ng!Pass').success).toBe(true);
    });

    it('should reject short password', () => {
      expect(passwordSchema.safeParse('Ab1!').success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      expect(passwordSchema.safeParse('lowercase1!').success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      expect(passwordSchema.safeParse('UPPERCASE1!').success).toBe(false);
    });

    it('should reject password without number', () => {
      expect(passwordSchema.safeParse('NoNumbers!').success).toBe(false);
    });

    it('should reject password without special char', () => {
      expect(passwordSchema.safeParse('NoSpecial1').success).toBe(false);
    });
  });

  describe('createUserSchema', () => {
    it('should accept valid user data', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        password: 'Str0ng!Pass',
        name: 'John',
        role: 'MEMBER',
      });
      expect(result.success).toBe(true);
    });

    it('should default role to MEMBER', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        password: 'Str0ng!Pass',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.role).toBe('MEMBER');
    });

    it('should reject invalid role', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        password: 'Str0ng!Pass',
        role: 'INVALID',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login', () => {
      expect(loginSchema.safeParse({ email: 'a@b.com', password: 'pass' }).success).toBe(true);
    });

    it('should reject empty password', () => {
      expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
    });
  });

  describe('createWorkflowSchema', () => {
    const validWorkflow = {
      name: 'My Workflow',
      steps: [{ id: 's1', type: 'action', name: 'Step 1', config: {} }],
    };

    it('should accept valid workflow', () => {
      expect(createWorkflowSchema.safeParse(validWorkflow).success).toBe(true);
    });

    it('should reject empty name', () => {
      expect(createWorkflowSchema.safeParse({ ...validWorkflow, name: '' }).success).toBe(false);
    });

    it('should reject empty steps', () => {
      expect(createWorkflowSchema.safeParse({ ...validWorkflow, steps: [] }).success).toBe(false);
    });

    it('should accept with optional fields', () => {
      const result = createWorkflowSchema.safeParse({
        ...validWorkflow,
        description: 'A test workflow',
        tags: ['test'],
        trigger: { type: 'manual', config: {} },
        variables: { key: 'value' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateWorkflowSchema', () => {
    it('should accept partial updates', () => {
      expect(updateWorkflowSchema.safeParse({ name: 'Updated' }).success).toBe(true);
    });

    it('should accept status update', () => {
      expect(updateWorkflowSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true);
    });

    it('should reject invalid status', () => {
      expect(updateWorkflowSchema.safeParse({ status: 'INVALID' }).success).toBe(false);
    });
  });

  describe('executeWorkflowSchema', () => {
    it('should accept empty execution', () => {
      expect(executeWorkflowSchema.safeParse({}).success).toBe(true);
    });

    it('should default dryRun to false', () => {
      const result = executeWorkflowSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.dryRun).toBe(false);
    });

    it('should accept input data', () => {
      expect(executeWorkflowSchema.safeParse({ input: { key: 'val' } }).success).toBe(true);
    });
  });

  describe('paginationSchema', () => {
    it('should apply defaults', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should coerce page/limit from strings', () => {
      const result = paginationSchema.safeParse({ page: '3', limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit > 100', () => {
      expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
    });

    it('should reject page < 1', () => {
      expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    });
  });

  describe('integrationConfigSchema', () => {
    it('should accept valid config', () => {
      const result = integrationConfigSchema.safeParse({
        integrationId: 'int-1',
        name: 'My Integration',
        credentials: { apiKey: 'abc' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      expect(integrationConfigSchema.safeParse({
        integrationId: 'int-1', name: '', credentials: {},
      }).success).toBe(false);
    });
  });

  describe('webhookSchema', () => {
    it('should accept valid webhook', () => {
      const result = webhookSchema.safeParse({
        name: 'My Webhook',
        events: ['deploy.created'],
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one event', () => {
      expect(webhookSchema.safeParse({ name: 'Wh', events: [] }).success).toBe(false);
    });

    it('should validate URL format', () => {
      expect(webhookSchema.safeParse({
        name: 'Wh', events: ['test'], url: 'not-a-url',
      }).success).toBe(false);
    });
  });

  describe('aiAgentSchema', () => {
    it('should accept valid agent', () => {
      expect(aiAgentSchema.safeParse({ name: 'Agent', model: 'gpt-4' }).success).toBe(true);
    });

    it('should reject empty name', () => {
      expect(aiAgentSchema.safeParse({ name: '', model: 'gpt-4' }).success).toBe(false);
    });

    it('should reject invalid temperature', () => {
      expect(aiAgentSchema.safeParse({ name: 'A', model: 'gpt-4', temperature: 3 }).success).toBe(false);
    });
  });

  describe('promptTemplateSchema', () => {
    it('should accept valid template', () => {
      expect(promptTemplateSchema.safeParse({
        name: 'Template', content: 'Hello {{name}}',
      }).success).toBe(true);
    });

    it('should reject empty content', () => {
      expect(promptTemplateSchema.safeParse({ name: 'T', content: '' }).success).toBe(false);
    });
  });

  describe('validateInput helper', () => {
    it('should return data on success', () => {
      const result = validateInput(emailSchema, 'test@example.com');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('test@example.com');
    });

    it('should return errors on failure', () => {
      const result = validateInput(emailSchema, 'invalid');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.issues.length).toBeGreaterThan(0);
    });
  });
});
