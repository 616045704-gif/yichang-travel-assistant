export type TestDocument = Record<string, unknown>;

export function createAiDatabaseFixture() {
  const documents = new Map<string, TestDocument>();
  let queue: Promise<void> = Promise.resolve();

  function api(store: Map<string, TestDocument>) {
    return {
      collection(name: string) {
        return {
          doc(id: string) {
            const key = `${name}:${id}`;
            return {
              async get() {
                const data = store.get(key);
                if (!data) throw new Error('not found');
                return { data: { ...data } };
              },
              async set(input: { data: TestDocument }) {
                store.set(key, { ...input.data, _id: id });
              },
            };
          },
          where(query: TestDocument) {
            const orders: Array<{ field: string; direction: 'asc' | 'desc' }> = [];
            const builder = {
              orderBy(field: string, direction: 'asc' | 'desc') {
                orders.push({ field, direction });
                return builder;
              },
              limit(count: number) {
                return {
                  async get() {
                    const data = [...store.entries()]
                      .filter(([key]) => key.startsWith(`${name}:`))
                      .map(([, value]) => ({ ...value }))
                      .filter(value => Object.entries(query).every(([field, expected]) => value[field] === expected))
                      .sort((left, right) => {
                        for (const order of orders) {
                          const compared = String(left[order.field] ?? '').localeCompare(String(right[order.field] ?? ''));
                          if (compared) return order.direction === 'asc' ? compared : -compared;
                        }
                        return 0;
                      })
                      .slice(0, count);
                    return { data };
                  },
                };
              },
            };
            return builder;
          },
        };
      },
    };
  }

  return {
    documents,
    ...api(documents),
    runTransaction<T>(callback: (transaction: ReturnType<typeof api>) => Promise<T>, _times = 3): Promise<T> {
      void _times;
      const run = queue.then(async () => {
        const staged = new Map([...documents].map(([key, value]) => [key, { ...value }]));
        const result = await callback(api(staged));
        documents.clear();
        for (const [key, value] of staged) documents.set(key, value);
        return result;
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}
