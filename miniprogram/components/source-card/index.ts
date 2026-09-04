import type { Source } from '../../../shared/contracts';

Component({
  properties: {
    facts: { type: Array, value: [] as string[] },
    references: { type: Array, value: [] as Source[] },
  },
});
