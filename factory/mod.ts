import { z } from '@std/zod';
import { Faker, en } from '@std/faker';
import { generateMock } from './zod-mock/mod.ts';

/**
 * A Least Recently Used (LRU) Cache implementation.
 * This cache has a maximum size and evicts the least recently used items when it reaches capacity.
 * 
 * @template K The type of the keys in the cache
 * @template V The type of the values in the cache
 * 
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>(3);
 * cache.set("a", 1);
 * cache.set("b", 2);
 * cache.set("c", 3);
 * console.log(cache.get("a")); // Output: 1
 * cache.set("d", 4); // This will evict "b" as it's the least recently used
 * console.log(cache.get("b")); // Output: undefined
 * ```
 */
class LRUCache<K, V> {
    private maxSize: number;
    private cache: Map<K, V>;

    /**
     * Creates a new LRUCache instance.
     * 
     * @param maxSize The maximum number of items the cache can hold
     * 
     * @example
     * ```typescript
     * const cache = new LRUCache<string, number>(100);
     * ```
     */
    constructor(maxSize: number) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    /**
     * Retrieves a value from the cache.
     * If the key exists, it moves the entry to the end (most recently used).
     * 
     * @param key The key to look up in the cache
     * @returns The value associated with the key, or undefined if not found
     * 
     * @example
     * ```typescript
     * const cache = new LRUCache<string, number>(3);
     * cache.set("key", 42);
     * console.log(cache.get("key")); // Output: 42
     * console.log(cache.get("nonexistent")); // Output: undefined
     * ```
     */
    get(key: K): V | undefined {
        if (!this.cache.has(key)) return undefined;

        // Move the accessed key to the end (most recently used)
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    /**
     * Adds or updates a key-value pair in the cache.
     * If the cache is at capacity and a new item is added, it evicts the least recently used item.
     * 
     * @param key The key to set or update
     * @param value The value to associate with the key
     * 
     * @example
     * ```typescript
     * const cache = new LRUCache<string, number>(2);
     * cache.set("a", 1);
     * cache.set("b", 2);
     * cache.set("c", 3); // This will evict "a"
     * console.log(cache.get("a")); // Output: undefined
     * ```
     */
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

    /**
     * Removes all entries from the cache.
     * 
     * @example
     * ```typescript
     * const cache = new LRUCache<string, number>(3);
     * cache.set("a", 1);
     * cache.set("b", 2);
     * cache.clear();
     * console.log(cache.get("a")); // Output: undefined
     * ```
     */
    clear(): void {
        this.cache.clear();
    }
}

/**
 * The maximum number of items to store in the cache.
 */
const MAX_CACHE_SIZE = 100;

/**
 * A cache to store generators for improved performance.
 */
const cache = new LRUCache<string, Generator<any>>(MAX_CACHE_SIZE);

/**
 * Creates a lazy generator that yields values from the provided generator function.
 * 
 * @param generator A function that returns a value of type T
 * @returns A generator that yields values of type T
 * 
 * @example
 * ```typescript
 * const numberGenerator = () => Math.random();
 * const lazyNumbers = lazyGenerator(numberGenerator);
 * 
 * console.log(lazyNumbers.next().value); // Outputs a random number
 * console.log(lazyNumbers.next().value); // Outputs another random number
 * ```
 */
function* lazyGenerator<T>(generator: () => T): Generator<T, void, unknown> {
    while (true) {
        yield generator();
    }
}

/**
 * A callback function that uses Faker to generate partial mock data.
 */
type FakerCallback<T> = (faker: Faker) => Partial<T>;

/**
 * Creates a mock factory function for a given Zod schema.
 * 
 * @param schema The Zod schema to create mocks for
 * @param fakerCallback An optional callback to customize the generated data
 * @returns A function that generates mock data conforming to the schema
 * 
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   age: z.number(),
 * });
 * 
 * const mockUser = createMockFactory(UserSchema, (faker) => ({
 *   name: faker.person.fullName(),
 *   age: faker.number.int({ min: 18, max: 80 }),
 * }));
 * 
 * const user = mockUser();
 * console.log(user); // Outputs a mock user object
 * ```
 */
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

/**
 * Creates a factory object for generating mock data based on a Zod schema.
 * 
 * @param schema The Zod schema to create mocks for
 * @param fakerCallback An optional callback to customize the generated data
 * @returns An object with methods to create and manipulate mock data
 * 
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   email: z.string().email(),
 * });
 * 
 * const userFactory = factory(UserSchema, (faker) => ({
 *   name: faker.person.fullName(),
 *   email: faker.internet.email(),
 * }));
 * 
 * // Create a single user
 * const user = userFactory.create();
 * console.log(user);
 * 
 * // Create multiple users
 * const users = userFactory.createMany(3);
 * console.log(users);
 * 
 * // Create a user with specific attributes
 * const customUser = userFactory.create({ name: "John Doe" });
 * console.log(customUser);
 * ```
 */
export function factory<T extends z.ZodTypeAny>(
    schema: T,
    fakerCallback?: FakerCallback<z.infer<T>>,
) {
    const mockFactory = createMockFactory(schema, fakerCallback);

    return {
        /**
         * Creates a single mock object based on the schema and optional attributes.
         * 
         * @param attributes Partial object to override generated values
         * @returns A mock object conforming to the schema
         * 
         * @example
         * ```typescript
         * const user = userFactory.create({ name: "Alice" });
         * console.log(user); // Outputs a user object with name "Alice"
         * ```
         */
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

        /**
         * Creates multiple mock objects based on the schema and optional attributes.
         * 
         * @param count The number of objects to create
         * @param attributes Partial object to override generated values
         * @returns An array of mock objects conforming to the schema
         * 
         * @example
         * ```typescript
         * const users = userFactory.createMany(3, { age: 25 });
         * console.log(users); // Outputs an array of 3 user objects, all with age 25
         * ```
         */
        createMany(
            count: number,
            attributes: Partial<z.infer<T>> = {},
        ): z.infer<T>[] {
            return Array.from({ length: count }, (_, index) => {
                const mockData = mockFactory();
                return this.create({ ...mockData, ...attributes, _index: index });
            }).map(({ _index, ...rest }) => rest as z.infer<T>);
        },

        /**
         * Creates a new factory with additional state or custom faker callback.
         * 
         * @param attributes Partial object or faker callback to extend the current factory
         * @returns A new factory instance with the extended state
         * 
         * @example
         * ```typescript
         * const adminFactory = userFactory.state({ role: "admin" });
         * const admin = adminFactory.create();
         * console.log(admin); // Outputs a user object with role "admin"
         * 
         * const seniorFactory = userFactory.state((faker) => ({ 
         *   age: faker.number.int({ min: 40, max: 65 }) 
         * }));
         * const seniorUser = seniorFactory.create();
         * console.log(seniorUser); // Outputs a user object with age between 40 and 65
         * ```
         */
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

        /**
         * Creates a raw mock object without validating against the schema.
         * 
         * @param attributes Partial object to override generated values
         * @returns A raw mock object that may not fully conform to the schema
         * 
         * @example
         * ```typescript
         * const rawUser = userFactory.raw({ name: "Bob" });
         * console.log(rawUser); // Outputs a raw user object with name "Bob"
         * ```
         */
        raw(attributes: Partial<z.infer<T>> = {}): z.infer<T> {
            return { ...mockFactory(), ...attributes };
        },
    };
}
