import type { z } from '@std/zod';
import { Faker, en } from '@std/faker';
import { generateMock } from './zod-mock/mod.ts';


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
