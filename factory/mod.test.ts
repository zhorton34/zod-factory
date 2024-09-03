import { z } from '@std/zod';
import { factory } from './mod.ts';
import { faker } from '@std/faker';
import { assertEquals, assertNotEquals, assertThrows } from '@std/assert';

const TestSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    age: z.number().int().positive(),
    createdAt: z.date(),
});

type TestType = z.infer<typeof TestSchema>;

const testFactory = factory(TestSchema, (faker) => ({ age: 30 }));

function validateSchema<T>(schema: z.ZodTypeAny, data: T) {
    const result = schema.safeParse(data);
    if (!result.success) {
        console.error('Schema validation failed:', JSON.stringify(result.error.issues, null, 2));
        console.error('Invalid data:', JSON.stringify(data, (key, value) =>
            typeof value === 'object' && value instanceof Date
                ? value.toISOString()
                : value
        , 2));
    }
    assertEquals(result.success, true);
}

Deno.test("Factory - basic creation tests", async (t) =>  {
    await t.step('factory - create', () => {
        const result = testFactory.create();
        validateSchema(TestSchema, result);
        validateSchema(TestSchema, result);
    });

    await t.step('factory - create with custom attributes', () => {
        const result = testFactory.create({ name: 'John Doe' });
        validateSchema(TestSchema, result);
        assertEquals(result.age, 30);
        assertEquals(result.name, 'John Doe');
    });

    await t.step('factory - createMany', () => {
        const results = testFactory.createMany(3);
        assertEquals(results.length, 3);
        results.forEach((result) => {
            validateSchema(TestSchema, result);
            assertEquals(result.age, 30);
        });
    });

    await t.step('factory - createMany with custom attributes', () => {
        const results = testFactory.createMany(3, { name: 'Jane Doe' });
        assertEquals(results.length, 3);
        results.forEach((result) => {
            validateSchema(TestSchema, result);
            assertEquals(result.age, 30);
            assertEquals(result.name, 'Jane Doe');
        });
    });
});

Deno.test("Factory - raw tests", async (t) => {
    await t.step('factory - raw', () => {
        const result = testFactory.raw();
        validateSchema(TestSchema, result);
        assertEquals(result.age, 30);
    });

    await t.step('factory - raw with custom attributes', () => {
        const result = testFactory.raw({ name: 'Bob' });
        validateSchema(TestSchema, result);
        assertEquals(result.age, 30);
        assertEquals(result.name, 'Bob');
    });
})

Deno.test("Factory - state tests", async (t) => {
    await t.step('factory - state', () => {
        const newFactory = testFactory.state({ name: 'Alice' });
        const result = newFactory.create();
        validateSchema(TestSchema, result);
        assertEquals(result.age, 30);
        assertEquals(result.name, 'Alice');
    });

    await t.step('factory - state with faker', () => {
        const newFactory = testFactory.state((faker) => ({
            name: faker.name.firstName(),
        }));
        const result = newFactory.create();
        validateSchema(TestSchema, result);
        assertNotEquals(result.name, '');
    });
})

Deno.test("Factory - input validation tests", async (t) => {
    await t.step('factory - handle invalid attribute types', () => {
        assertThrows(
            () => {
                testFactory.create({ age: -10 } as any);
            },
            Error,
            'Invalid input',
        );
    })

    await t.step('factory - handle missing required attributes', () => {
        assertThrows(
            () => {
                testFactory.create({ name: undefined } as any);
            },
            Error,
            'Invalid input',
        );
    });
})

// Performance Tests
Deno.test("Factory - performance tests", async (t) => {
    await t.step('factory - performance test for createMany', () => {
        const start = performance.now();
        const results = testFactory.createMany(1000);
        const end = performance.now();
        assertEquals(results.length, 1000);
        console.log(`Performance test: createMany(100) took ${end - start}ms`);
    });
})


Deno.test("Factory - complex schema tests", async (t) => {

    const ComplexSchema = z.object({
        id: z.string().uuid(),
        user: z.object({
            name: z.string().default('Default User'),
            email: z.string().email(),
            profile: z.object({
                bio: z.string(),
                socialMedia: z.array(z.object({
                    platform: z.enum(['twitter', 'facebook', 'instagram'] as const),
                    username: z.string(),
                })),
            }),
        }),
        posts: z.array(z.object({
            title: z.string(),
            content: z.string(),
            tags: z.array(z.string()),
            publishedAt: z.date(),
        })),
        settings: z.object({
            theme: z.enum(['light', 'dark'] as const),
            notifications: z.boolean(),
            preferences: z.record(
                z.string(),
                z.union([z.string(), z.number(), z.boolean()]),
            ),
        }),
    });

    let complexFactory = factory(ComplexSchema, (faker) => ({
        id: faker.string.uuid(),
        user: {
            name: 'Default User',
            email: faker.internet.email(),
            profile: {
                bio: faker.lorem.paragraph(),
                socialMedia: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
                    platform: faker.helpers.arrayElement(['twitter', 'facebook', 'instagram'] as const),
                    username: faker.internet.userName(),
                })),
            },
        },
        posts: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
            title: faker.lorem.sentence(),
            content: faker.lorem.paragraphs(),
            tags: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.lorem.word()),
            publishedAt: new Date(faker.date.past().getTime()), // Ensure we're creating a valid Date object
        })),
        settings: {
            theme: faker.helpers.arrayElement(['light', 'dark'] as const),
            notifications: faker.datatype.boolean(),
            preferences: Object.fromEntries(
                Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => [
                    faker.lorem.word(),
                    faker.helpers.arrayElement([
                        faker.lorem.word(),
                        faker.number.int(),
                        faker.datatype.boolean(),
                    ]),
                ])
            ),
        },
    }));

    await t.step('complex factory - create validates against schema', () => {
        const result = complexFactory.create();
        const parseResult = ComplexSchema.safeParse(result);
        if (!parseResult.success) {
            console.error('Schema validation failed:', parseResult.error);
            console.log(JSON.stringify(result, null, 2));
        }
        assertEquals(parseResult.success, true);
    });

    await t.step('complex factory - create sets default user name', () => {
        const result = complexFactory.create();
        assertEquals(result.user.name, 'Default User');
    });

    await t.step('complex factory - create with deep profile override', () => {
        const result = complexFactory.create({
            user: {
                name: 'John Doe',
                email: 'john@example.com',
                profile: {
                    bio: 'Custom bio',
                    socialMedia: [
                        { platform: 'facebook', username: 'custom_user' },
                    ],
                },
            },
            // We need to provide other required fields that are not part of the user object
            id: faker.string.uuid(),
            posts: [
                {
                    title: 'Test Post',
                    content: 'Test Content',
                    tags: ['test'],
                    publishedAt: new Date(faker.date.past().getTime()), // Ensure we're creating a valid Date object
                }
            ],
            settings: {
                theme: 'light',
                notifications: true,
                preferences: { testPref: 'value' },
            },
        });

        assertEquals(result.user.name, 'John Doe');
        assertEquals(result.user.profile.bio, 'Custom bio');
        assertEquals(result.user.profile.socialMedia[0].platform, 'facebook');
        assertEquals(result.user.profile.socialMedia[0].username, 'custom_user');
    });

    await t.step('complex factory - create with deep settings override', () => {
        const result = complexFactory.create({
            settings: {
                theme: 'dark',
                notifications: false,
                preferences: {}, // Provide an empty object for preferences
            },
        });
        
        assertEquals(result.settings.theme, 'dark');
        assertEquals(result.settings.notifications, false);
        assertEquals(typeof result.settings.preferences, 'object');
    })

    await t.step('complex factory - implement with transform', () => {
        const SouthLawPropertySchema = z.object({
            street: z.string(),
            city: z.string(),
            state: z.string().length(2),
            zip: z.string().regex(/^\d{5}$/),
            county: z.string(),
            sale_date: z.string(),
            sale_time: z.string(),
            continued_date_time: z.string().optional(),
            opening_bid: z.string().optional(),
            sale_location: z.string(),
            firm_file_number: z.string().min(1, 'Cannot be empty').refine(
                (value) => /^[0-9]+$/.test(value),
                {
                    message: 'Firm File Number must be unique and contain only numbers',
                },
            ),
        });
        
        const property = factory(SouthLawPropertySchema, (faker) => ({
            street: faker.location.streetAddress(),
            city: faker.location.city(),
            state: faker.location.state({ abbreviated: true }),
            zip: faker.location.zipCode('#####'),
            county: faker.location.county(),
            sale_date: faker.date.future().toISOString().split('T')[0],
            sale_time: faker.date.future().toLocaleTimeString(),
            continued_date_time: "N/A",
            opening_bid: faker.helpers.arrayElement(["N/A", "$100,000", "$200,000", "$300,000", "$400,000", "$500,000"]),
            sale_location: faker.location.city(),
            firm_file_number: faker.string.numeric(9)
        })).create();
        
        console.log(JSON.stringify(property, null, 2));

        // Validate that only the properties from SouthLawPropertySchema are present
        const propertyKeys = Object.keys(property);
        const schemaKeys = Object.keys(SouthLawPropertySchema.shape);
        assertEquals(propertyKeys.sort(), schemaKeys.sort());

        // Validate that the created property matches the schema
        const validationResult = SouthLawPropertySchema.safeParse(property);
        assertEquals(validationResult.success, true);
    });
})

// Test for Randomness and Uniqueness
Deno.test("Factory - Randomness and Uniqueness", async (t) => {
    const UserSchema = z.object({
        user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
        })
    })

    const UserFactory = factory(UserSchema, (faker) => ({
        user: {
            id: faker.string.uuid(),
            email: faker.internet.email(),
        }
    }))

    await t.step('complex factory - createMany generates unique IDs', () => {
        const results = UserFactory.createMany(2);
        assertNotEquals(results[0].user.id, results[1].user.id);
    });

    await t.step('complex factory - createMany generates unique emails', () => {
        const results = UserFactory.createMany(2);
        assertNotEquals(results[0].user.email, results[1].user.email);
    });
});