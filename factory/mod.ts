import type { z } from '@std/zod';
import { Faker, en } from '@std/faker';
import { generateMock } from './zod-mock/mod.ts';

/**
 * Represents a factory for creating mock data based on a Zod schema.
 *
 * @template T - The Zod schema type
 */
// deno-lint-ignore no-explicit-any
interface Factory<T extends z.ZodType<any>> {
    /**
     * Creates a single mock object based on the schema.
     *
     * @param {Partial<z.infer<T>>} [attributes] - Optional partial attributes to override generated values
     * @returns {z.infer<T>} A mock object conforming to the schema
     */
    create: (attributes?: Partial<z.infer<T>>) => z.infer<T>;

    /**
     * Creates multiple mock objects based on the schema.
     *
     * @param {number} count - The number of mock objects to create
     * @param {Partial<z.infer<T>>} [attributes] - Optional partial attributes to override generated values
     * @returns {z.infer<T>[]} An array of mock objects conforming to the schema
     */
    createMany: (count: number, attributes?: Partial<z.infer<T>>) => z.infer<T>[];

    /**
     * Creates a new factory with modified state.
     *
     * @param {Partial<z.infer<T>> | FakerCallback<z.infer<T>>} attributes - Partial attributes or a faker callback to modify the factory state
     * @returns {Factory<T>} A new factory instance with the modified state
     */
    state: (attributes: Partial<z.infer<T>> | FakerCallback<z.infer<T>>) => Factory<T>;

    /**
     * Creates a raw mock object based on the schema without running it through schema validation.
     *
     * @param {Partial<z.infer<T>>} [attributes] - Optional partial attributes to override generated values
     * @returns {z.infer<T>} A raw mock object conforming to the schema structure
     */
    raw: (attributes?: Partial<z.infer<T>>) => z.infer<T>;
}

/**
 * A callback function that uses Faker to generate partial mock data.
 */
type FakerCallback<T> = (faker: Faker) => Partial<T>;

// deno-lint-ignore no-explicit-any
function createMockFactory<T extends z.ZodType<any>>(
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
        const mergedData = { ...(mockData as Record<string, unknown>), ...fakerData };
        return schema.parse(mergedData);
    };
}

// deno-lint-ignore no-explicit-any
export function factory<T extends z.ZodType<any>>(
    schema: T,
    fakerCallback?: FakerCallback<z.infer<T>>,
): Factory<T> {
    const mockFactory = createMockFactory(schema, fakerCallback);

    return {
        create(attributes: Partial<z.infer<T>> = {} as Partial<z.infer<T>>): z.infer<T> {
            const mergedData = {
                ...(mockFactory() as Record<string, unknown>),
                ...(attributes as Record<string, unknown>)
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
            attributes: Partial<z.infer<T>> = {} as Partial<z.infer<T>>,
        ): z.infer<T>[] {
            return Array.from({ length: count }, (_, index) => {
                const mockData = mockFactory() as Record<string, unknown>;
                return this.create({ ...mockData, ...(attributes as Record<string, unknown>), _index: index } as unknown as Partial<z.infer<T>>);
            }).map((item) => {
                const { _index: _, ...rest } = item as Record<string, unknown>;
                return rest as z.infer<T>;
            });
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

        raw(attributes: Partial<z.infer<T>> = {} as Partial<z.infer<T>>): z.infer<T> {
            return { ...(mockFactory() as Record<string, unknown>), ...(attributes as Record<string, unknown>) } as z.infer<T>;
        },
    };
}
