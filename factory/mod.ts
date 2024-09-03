import { z } from '@std/zod';
import { Faker, en } from '@std/faker';
import { generateMock } from './zod-mock/mod.ts';

class LRUCache<K, V> {
    private maxSize: number;
    private cache: Map<K, V>;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key: K): V | undefined {
        if (!this.cache.has(key)) return undefined;

        // Move the accessed key to the end (most recently used)
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key); // Remove the existing entry
        } else if (this.cache.size >= this.maxSize) {
            // Remove the least recently used item
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear(): void {
        this.cache.clear();
    }
}

// Define a reasonable cache size
const MAX_CACHE_SIZE = 100;
const cache = new LRUCache<string, Generator<any>>(MAX_CACHE_SIZE);

function* lazyGenerator<T>(generator: () => T): Generator<T, void, unknown> {
    while (true) {
        yield generator();
    }
}

type FakerCallback<T> = (faker: Faker) => Partial<T>;

function createMockFactory<T extends z.ZodTypeAny>(
    schema: T,
    fakerCallback?: FakerCallback<z.infer<T>>,
): () => z.infer<T> {
    return () => {
        const localFaker = new Faker({
            locale: [en],
        })
        localFaker.seed(Date.now());

        const mockData = generateMock(schema, { 
            faker: localFaker,
        });

        const fakerData = fakerCallback ? fakerCallback(localFaker) : {};
        const mergedData = { ...mockData, ...fakerData };
        return schema.parse(mergedData);
    };
}

export function factory<T extends z.ZodTypeAny>(
    schema: T,
    fakerCallback?: FakerCallback<z.infer<T>>,
) {
    const mockFactory = createMockFactory(schema, fakerCallback);

    return {
        create(attributes: Partial<z.infer<T>> = {}): z.infer<T> {
            const mergedData = {
                ...mockFactory(),
                ...attributes
            };

            const parseResult = schema.safeParse(mergedData);
            if (parseResult.success) {
                return parseResult.data;
            } else {
                throw new Error(`Invalid input: ${parseResult.error}`);
            }
        },

        createMany(
            count: number,
            attributes: Partial<z.infer<T>> = {},
        ): z.infer<T>[] {
            return Array.from({ length: count }, (_, index) => {
                const mockData = mockFactory();
                return this.create({ ...mockData, ...attributes, _index: index });
            }).map(({ _index, ...rest }) => rest as z.infer<T>);
        },

        state(
            attributes:
                | Partial<z.infer<T>>
                | FakerCallback<z.infer<T>>,
        ) {
            const newFakerCallback = typeof attributes === 'function'
                ? (f: Faker) => ({ ...fakerCallback?.(f), ...attributes(f) })
                : (f: Faker) => ({ ...fakerCallback?.(f), ...attributes });
            return factory(schema, newFakerCallback);
        },

        raw(attributes: Partial<z.infer<T>> = {}): z.infer<T> {
            return { ...mockFactory(), ...attributes };
        },
    };
}
