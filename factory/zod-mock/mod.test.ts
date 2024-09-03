import { z } from '@std/zod';
import { faker } from '@std/faker';
import { generateMock, ZodMockError } from './mod.ts';
import { assert, assertEquals, assertMatch, assertThrows } from '@std/assert';

Deno.test('zod-mock', async (t) => {
    await t.step('should generate a mock object using faker', () => {
        enum NativeEnum {
            a = 1,
            b = 2,
        }

        const schema = z.object({
            uid: z.string().min(1),
            theme: z.enum([`light`, `dark`]),
            name: z.string(),
            firstName: z.string(),
            email: z.string().email().optional(),
            phoneNumber: z.string().min(10).optional(),
            avatar: z.string().url().optional(),
            jobTitle: z.string().optional(),
            otherUserEmails: z.array(z.string().email()),
            stringArrays: z.array(z.string()),
            stringLength: z.string().transform((val) => val.length),
            numberCount: z.number().transform((item) =>
                `total value = ${item}`
            ),
            age: z.number().min(18).max(120),
            record: z.record(z.string(), z.number()),
            nativeEnum: z.nativeEnum(NativeEnum),
            set: z.set(z.string()),
            map: z.map(z.string(), z.number()),
            discriminatedUnion: z.discriminatedUnion('discriminator', [
                z.object({ discriminator: z.literal('a'), a: z.boolean() }),
                z.object({ discriminator: z.literal('b'), b: z.string() }),
            ]),
        });

        const mockData = generateMock(schema);

        assertEquals(typeof mockData.uid, 'string');
        assert(mockData.theme === 'light' || mockData.theme === 'dark');
        assertMatch(mockData.email || '', /\S+@\S+\.\S+/);
        assertMatch(
            mockData.avatar || '',
            /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i,
        );
        assertEquals(typeof mockData.phoneNumber, 'string');
        assertEquals(typeof mockData.jobTitle, 'string');
        assertEquals(typeof mockData.stringLength, 'number');
        assertEquals(typeof mockData.numberCount, 'string');
        assert(mockData.age >= 18 && mockData.age <= 120);
        assertEquals(typeof mockData.record, 'object');
        assertEquals(typeof Object.values(mockData.record)[0], 'number');
        assert(mockData.nativeEnum === 1 || mockData.nativeEnum === 2);
        assert(mockData.set instanceof Set);
        assert(mockData.map instanceof Map);
        assert(mockData.discriminatedUnion !== undefined);
    });

    await t.step(
        'should generate mock data of the appropriate type when the field names overlap Faker properties that are not valid functions',
        () => {
            const schema = z.object({
                lorem: z.string(),
                phoneNumber: z.string().min(10).optional(),
                shuffle: z.string(),
                seed: z.string(),
            });

            const mockData = generateMock(schema);
            assertEquals(typeof mockData.lorem, 'string');
            assertEquals(typeof mockData.phoneNumber, 'string');
            assertEquals(typeof mockData.shuffle, 'string');
            assertEquals(typeof mockData.seed, 'string');
        },
    );

    await t.step('Should manually mock string key names to set values', () => {
        const schema = z.object({
            uid: z.string().min(1),
            theme: z.enum([`light`, `dark`]),
            locked: z.string(),
            email: z.string().email(),
            camelCase: z.string(),
        });

        const stringMap = {
            locked: () => `value set`,
            email: () => `not a email anymore`,
            camelCase: () => 'Exact case works',
        };

        const mockData = generateMock(schema, { stringMap });

        assertMatch(
            mockData.uid,
            /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
        );
        assertMatch(mockData.theme, /light|dark/);
        assertEquals(mockData.locked, 'value set');
        assertEquals(mockData.email, 'not a email anymore');
        assertEquals(mockData.camelCase, stringMap.camelCase());
    });

    await t.step(
        'should convert values produced by Faker to string when the schema type is string.',
        () => {
            const schema = z.object({
                number: z.string(),
                boolean: z.string(),
                date: z.string(),
            });
            const mockData = generateMock(schema);
            assertEquals(typeof mockData.number, 'string');
            assertEquals(typeof mockData.boolean, 'string');
            assertEquals(typeof mockData.date, 'string');
        },
    );

    await t.step(
        "should support generating date strings via Faker for keys of 'date' and 'dateTime'.",
        () => {
            const schema = z.object({
                date: z.string(),
            });
            const mockData = generateMock(schema);
            assert(!isNaN(new Date(mockData.date).getTime()));
        },
    );

    await t.step(
        'should correctly generate date strings for date validated strings',
        () => {
            const schema = z.object({
                dateString: z.string().datetime(),
            });
            const mockData = generateMock(schema);
            assert(!isNaN(new Date(mockData.dateString).getTime()));
        },
    );

    await t.step(
        'should create mock strings that respect the specified min and max lengths (inclusive)',
        () => {
            const createSchema = (min: number, max: number) =>
                z.object({
                    default: z.string().min(min).max(max),
                    email: z.string().min(min).max(max),
                    uuid: z.string().min(min).max(max),
                    url: z.string().min(min).max(max),
                    name: z.string().min(min).max(max),
                    color: z.string().min(min).max(max),
                    notFound: z.string().min(min).max(max),
                });

            const min = 1;
            const max = 5;
            const mockData = generateMock(createSchema(min, max));
            Object.values(mockData).forEach((val) => {
                assert(val.length >= min && val.length <= max);
            });
        },
    );

    await t.step(
        'should respect the max length when the min is greater than the max',
        () => {
            const createSchema = (min: number, max: number) =>
                z.object({
                    default: z.string().min(min).max(max),
                    email: z.string().min(min).max(max),
                    uuid: z.string().min(min).max(max),
                    url: z.string().min(min).max(max),
                    name: z.string().min(min).max(max),
                    color: z.string().min(min).max(max),
                    notFound: z.string().min(min).max(max),
                });

            const min = 5;
            const max = 2;
            const mockData = generateMock(createSchema(min, max));
            Object.values(mockData).forEach((val) => {
                assert(val.length <= max);
            });
        },
    );

    await t.step(
        'should append extra string content to meet a minimum length',
        () => {
            const createSchema = (min: number, max: number) =>
                z.object({
                    default: z.string().min(min).max(max),
                    email: z.string().min(min).max(max),
                    uuid: z.string().min(min).max(max),
                    url: z.string().min(min).max(max),
                    name: z.string().min(min).max(max),
                    color: z.string().min(min).max(max),
                    notFound: z.string().min(min).max(max),
                });

            const min = 100;
            const max = 100;
            const mockData = generateMock(createSchema(min, max));
            Object.values(mockData).forEach((val) => {
                assert(val.length >= min && val.length <= max);
            });
        },
    );

    await t.step(
        'should create mock strings that respect the specified length',
        () => {
            const createSchema = (len: number) =>
                z.object({
                    default: z.string().length(len),
                });

            const length = 33;
            const mockData = generateMock(createSchema(length));
            Object.values(mockData).forEach((val) => {
                assertEquals(val.length, length);
            });
        },
    );

    await t.step(
        'should create mock dates that respect the specified min and max dates',
        () => {
            const min = new Date('2022-01-01T00:00:00.000Z');
            const max = new Date('2023-01-01T00:00:00.000Z');

            const schema = z.object({
                dateWithMin: z.date().min(min),
                dateWithMax: z.date().max(max),
                dateWithRange: z.date().min(min).max(max),
                dateWithInvertedRange: z.date().min(max).max(min),
            });
            const mockData = generateMock(schema);

            assert(mockData.dateWithMin.getTime() >= min.getTime());
            assert(mockData.dateWithMax.getTime() <= max.getTime());
            assert(mockData.dateWithRange.getTime() >= min.getTime());
            assert(mockData.dateWithRange.getTime() <= max.getTime());
            assertEquals(mockData.dateWithInvertedRange, undefined);
        },
    );

    await t.step('should create Maps', () => {
        const schema = z.map(z.string(), z.number());
        const generated = generateMock(schema);

        assert(generated.size > 0);
        const entries = [...generated.entries()];
        entries.forEach(([k, v]) => {
            assert(k);
            assert(v);
        });
    });

    await t.step(
        'should use a user provided generator when a generator for the schema type cannot be found',
        () => {
            const notUndefined = () => 'not undefined';
            // undefined is used because we have no reason to create a generator for it because the net result
            // will be undefined.
            const mock = generateMock(z.undefined(), {
                backupMocks: { ZodUndefined: notUndefined },
            });
            assertEquals(mock, notUndefined());
        },
    );

    await t.step(
        'should use a user provided generator when a generator takes 2 arguments',
        () => {
            // Given
            const custom = z.custom<Date>((val) => val instanceof Date);
            const anyDate = () => new Date('2023-01-01T00:00:00.000Z');
            const zodCustomBackupMock = (ref: z.ZodType): Date | void => {
                if (ref === (custom as z.ZodEffects<z.ZodAny>)._def.schema) {
                    return anyDate();
                }
            };

            // When
            const mock = generateMock(custom, {
                backupMocks: { ZodAny: zodCustomBackupMock },
            });

            // Then
            assertEquals(mock, anyDate());

            // When
            const mock2 = generateMock(
                z.custom(() => false),
                {
                    backupMocks: { ZodAny: zodCustomBackupMock },
                },
            );

            // Then
            assertEquals(mock2, undefined);
        },
    );

    await t.step('should work with objects and arrays', () => {
        const notUndefined = () => 'not undefined';
        const schema = z.object({
            data: z.array(z.undefined()).length(1),
        });
        const mock = generateMock(schema, {
            backupMocks: { ZodUndefined: notUndefined },
        });
        assertEquals(mock.data[0], notUndefined());
    });

    await t.step('should work with the README example', () => {
        const schema = z.object({
            anyVal: z.any(),
        });

        const mockData = generateMock(schema, {
            backupMocks: {
                ZodAny: () => 'any value',
            },
        });
        assertEquals(mockData.anyVal, 'any value');
    });

    await t.step(
        'throws an error when configured to if we have not implemented the type mapping',
        () => {
            assertThrows(
                () => generateMock(z.any(), { throwOnUnknownType: true }),
                ZodMockError,
            );
        },
    );

    // TODO: enable tests as their test types are implemented
    // Missing types tests are commented out

    await t.step('ZodDefault', () => {
        const value = generateMock(z.string().default('a'));
        assert(value);
        assertEquals(typeof value, 'string');
    });

    await t.step('ZodNativeEnum', () => {
        enum NativeEnum {
            a = 1,
            b = 2,
        }

        const first = generateMock(z.nativeEnum(NativeEnum));
        assert(first === 1 || first === 2);

        const ConstAssertionEnum = {
            a: 1,
            b: 2,
        } as const;

        const second = generateMock(z.nativeEnum(ConstAssertionEnum));
        assert(second === 1 || second === 2);
    });

    await t.step('ZodFunction', () => {
        const func = generateMock(z.function(z.tuple([]), z.string()));
        assert(func);
        assertEquals(typeof func(), 'string');
    });

    await t.step('ZodIntersection', () => {
        const Person = z.object({
            name: z.string(),
        });

        const Employee = z.object({
            role: z.string(),
        });

        const EmployedPerson = z.intersection(Person, Employee);
        const generated = generateMock(EmployedPerson);
        assert(generated);
        assert(generated.name);
        assert(generated.role);
    });

    await t.step('ZodPromise', async () => {
        const promise = generateMock(z.promise(z.string()));
        assert(promise);
        const result = await promise;
        assertEquals(typeof result, 'string');
    });

    await t.step('ZodTuple', async (t) => {
        await t.step('basic tuple', () => {
            const generated = generateMock(
                z.tuple([z.number(), z.string(), z.boolean()]),
            );
            assert(generated);
            const [num, str, bool] = generated;

            assertEquals(typeof num, 'number');
            assertEquals(typeof str, 'string');
            assertEquals(typeof bool, 'boolean');
        });

        await t.step('tuple with Rest args', () => {
            const generated = generateMock(
                z.tuple([z.number(), z.boolean()]).rest(z.string()),
            );
            assert(generated);
            const [num, bool, ...rest] = generated;

            assertEquals(typeof num, 'number');
            assertEquals(typeof bool, 'boolean');
            assert(rest.length > 0);
            for (const item of rest) {
                assertEquals(typeof item, 'string');
            }
        });
    });

    await t.step('ZodUnion', () => {
        assert(generateMock(z.union([z.number(), z.string()])));
    });

    await t.step('Avoid depreciations in strings', () => {
        const warn = console.warn;
        console.warn = () => {};
        generateMock(
            z.object({
                image: z.string(),
                number: z.string(),
                float: z.string(),
                uuid: z.string(),
                boolean: z.string(),
                hexaDecimal: z.string(),
            }),
        );
        console.warn = warn;
    });

    await t.step('should generate strings from regex', () => {
        const regResult = generateMock(
            z.object({
                data: z.string().regex(/^[A-Z0-9+_.-]+@[A-Z0-9.-]+$/),
            }),
        );
        assertMatch(regResult.data, /^[A-Z0-9+_.-]+@[A-Z0-9.-]+$/);
    });

    await t.step('should handle complex unions', () => {
        const result = generateMock(z.object({ date: z.date() }));
        assert(result.date instanceof Date);

        // Date
        const variousTypes = z.union([
            z
                .string()
                .min(1)
                .max(100)
                .transform((v) => v.length),
            z.number().gt(1).lt(100),
            z
                .string()
                .regex(/^(100|[1-9][0-9]?)$/)
                .transform((v) => parseInt(v)),
        ]);
        const TransformItem = z.object({
            id: z.string().nonempty({ message: 'Missing ID' }),
            name: z.string().optional(),
            items: variousTypes,
        });
        const transformResult = generateMock(TransformItem);
        assert(transformResult.items > 0);
        assert(transformResult.items < 101);
    });

    await t.step('should handle discriminated unions', () => {
        const FirstType = z.object({
            hasEmail: z.literal(false),
            userName: z.string(),
        });

        const SecondType = z.object({
            hasEmail: z.literal(true),
            email: z.string(),
        });

        const Union = z.discriminatedUnion('hasEmail', [FirstType, SecondType]);

        const result = generateMock(Union);
        assert(result);

        if (result.hasEmail) {
            assert(result.email);
        } else {
            assert('userName' in result);
            assert(result.userName);
        }
    });

    await t.step('should handle branded types', () => {
        const Branded = z.string().brand<'__brand'>();

        const result = generateMock(Branded);
        assert(result);
    });

    await t.step('ZodVoid', () => {
        assertEquals(generateMock(z.void()), undefined);
    });

    await t.step('ZodNull', () => {
        assertEquals(generateMock(z.null()), null);
    });

    await t.step('ZodNaN', () => {
        assert(isNaN(generateMock(z.nan())));
    });

    await t.step('ZodUndefined', () => {
        assertEquals(generateMock(z.undefined()), undefined);
    });

    await t.step('ZodLazy', () => {
        assert(generateMock(z.lazy(() => z.string())));
    });

    await t.step(
        'Options seed value will return the same random numbers',
        () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });
            const seed = 123;
            const first = generateMock(schema, { seed });
            const second = generateMock(schema, { seed });
            assertEquals(first, second);
        },
    );

    await t.step(
        'Options seed value will return the same union & enum members',
        () => {
            enum NativeEnum {
                a = 1,
                b = 2,
            }

            const schema = z.object({
                theme: z.enum([`light`, `dark`]),
                nativeEnum: z.nativeEnum(NativeEnum),
                union: z.union([z.literal('a'), z.literal('b')]),
                discriminatedUnion: z.discriminatedUnion('discriminator', [
                    z.object({ discriminator: z.literal('a'), a: z.boolean() }),
                    z.object({ discriminator: z.literal('b'), b: z.string() }),
                ]),
            });
            const seed = 123;
            const first = generateMock(schema, { seed });
            const second = generateMock(schema, { seed });
            assertEquals(first, second);
        },
    );

    await t.step(
        'Options seed value will return the same generated regex values',
        () => {
            const schema = z.object({
                data: z.string().regex(/^[A-Z0-9+_.-]+@[A-Z0-9.-]+$/),
            });
            const seed = 123;
            const first = generateMock(schema, { seed });
            const second = generateMock(schema, { seed });
            assertEquals(first, second);
        },
    );

    await t.step('Can use my own version of faker', () => {
        enum NativeEnum {
            a = 1,
            b = 2,
        }

        const schema = z.object({
            uid: z.string().nonempty(),
            theme: z.enum([`light`, `dark`]),
            name: z.string(),
            firstName: z.string(),
            email: z.string().email().optional(),
            phoneNumber: z.string().min(10).optional(),
            avatar: z.string().url().optional(),
            jobTitle: z.string().optional(),
            otherUserEmails: z.array(z.string().email()),
            stringArrays: z.array(z.string()),
            stringLength: z.string().transform((val) => val.length),
            numberCount: z.number().transform((item) =>
                `total value = ${item}`
            ),
            age: z.number().min(18).max(120),
            record: z.record(z.string(), z.number()),
            nativeEnum: z.nativeEnum(NativeEnum),
            set: z.set(z.string()),
            map: z.map(z.string(), z.number()),
            discriminatedUnion: z.discriminatedUnion('discriminator', [
                z.object({ discriminator: z.literal('a'), a: z.boolean() }),
                z.object({ discriminator: z.literal('b'), b: z.string() }),
            ]),
            dateWithMin: z.date().min(new Date('2023-01-01T00:00:00Z')),
        });

        faker.seed(3);
        const first = generateMock(schema, { faker });
        faker.seed(3);
        const second = generateMock(schema, { faker });
        const third = generateMock(schema);
        assertEquals(first, second);
        assert(first !== third);
    });

    await t.step('Will mock sub objections properly', () => {
        const airline = z.object({
            flightNumber: z.string(),
            departure: z.object({
                airport: z.string(),
                time: z.date(),
            }),
            arrival: z.object({
                airport: z.string(),
                time: z.date(),
            }),
        });

        const flight = z.object({
            operating_airline: airline,
            marketing_airline: airline,
        });

        const mockedFlight = generateMock(flight, {
            stringMap: {
                airport: () => faker.airline.airport().iataCode,
            },
        });

        assertEquals(
            mockedFlight.operating_airline.departure.airport.length,
            3,
        );
        assertEquals(mockedFlight.operating_airline.arrival.airport.length, 3);
        assertEquals(
            mockedFlight.marketing_airline.departure.airport.length,
            3,
        );
        assertEquals(mockedFlight.marketing_airline.arrival.airport.length, 3);
        assert(mockedFlight.operating_airline.departure.time instanceof Date);
        assert(mockedFlight.operating_airline.flightNumber.length < 5);
    });

    await t.step('should handle various date constraints correctly', () => {
        const now = new Date();
        const pastDate = new Date(now.getTime() - 86400000); // 1 day ago
        const futureDate = new Date(now.getTime() + 86400000); // 1 day in future
    
        const tests = [
            { schema: z.date().min(pastDate), description: 'date with min' },
            { schema: z.date().max(futureDate), description: 'date with max' },
            { schema: z.date().min(pastDate).max(futureDate), description: 'date with min and max' },
            { schema: z.date(), description: 'date without constraints' },
            { schema: z.date().min(futureDate).max(pastDate), description: 'date with swapped min and max' },
        ];
    
        tests.forEach(({ schema, description }) => {
            const result = generateMock(schema);
            if (description === 'date with swapped min and max') {
                assertEquals(result, undefined, `${description} should return undefined`);
            } else {
                assert(result instanceof Date, `${description} should return a Date`);
                
                if ('min' in schema._def && schema._def.min instanceof Date) {
                    assert(result >= schema._def.min, `${description} should be after or equal to min`);
                }
                if ('max' in schema._def && schema._def.max instanceof Date) {
                    assert(result <= schema._def.max, `${description} should be before or equal to max`);
                }
            }
        });
    });
    
    await t.step('should handle invalid date constraints', () => {
        const futureDate = new Date(Date.now() + 86400000); // 1 day in future
        const pastDate = new Date(Date.now() - 86400000); // 1 day ago
    
        const schema = z.date().min(futureDate).max(pastDate);
        const result = generateMock(schema);
    
        assertEquals(result, undefined, 'Should return undefined for invalid constraints');
    });

    await t.step('should handle JSON type', () => {
        const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
        type Literal = z.infer<typeof literalSchema>;
        type Json = Literal | { [key: string]: Json } | Json[];
        const jsonSchema: z.ZodType<Json> = z.lazy(() =>
            z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
        );

        const result = generateMock(jsonSchema);
        assert(result !== undefined);
        // Additional assertions can be added based on the expected structure
    });
});


Deno.test("Potential infinite loop or memory exhaustion tests", async (t) => {
    await t.step('should handle deep recursive structures without stack overflow', () => {
        const deeplyNestedSchema: z.ZodType<unknown> = z.object({
            value: z.number(),
            nested: z.lazy(() => deeplyNestedSchema.optional()),
        });

        const result = generateMock(deeplyNestedSchema);
        let depth = 0;
        let current = result;
        while ((current as { nested: unknown }).nested as unknown as object) {
            depth++;
            current = (current as { nested: unknown }).nested as unknown as object;
            if (depth > 1000) {
                throw new Error('Possible infinite recursion detected');
            }
        }
        assert(depth > 0, 'Should generate at least some nested levels');
    });

    await t.step('should handle cyclical references gracefully', () => {
        // This test checks if the mock generator can handle potential cyclical structures
        // without causing an infinite loop
        const cyclicalSchema: z.ZodType<unknown> = z.lazy(() => z.object({
            id: z.string(),
            related: z.array(cyclicalSchema).optional(),
        }));

        const result = generateMock(cyclicalSchema) as { id: string, related: object[] };
        assert((result as { id: string }).id);
        if ((result as { related: unknown }).related as unknown as object) {
            assert(Array.isArray(result.related as unknown as object[]));
            // Check only the first level to avoid potential infinite loop
            if ((result.related as unknown as object[]).length > 0) {
                assert((result.related[0] as { id: string }).id);
            }
        }
    });

    // await t.step('should generate large complex structures efficiently', () => {
    //     const complexSchema = z.object({
    //         id: z.string().uuid(),
    //         data: z.array(z.object({
    //             key: z.string(),
    //             value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    //             metadata: z.record(z.string(), z.unknown()),
    //         })).min(100),
    //         nested: z.lazy(() => complexSchema.optional()),
    //     });

    //     const start = performance.now();
    //     const result = generateMock(complexSchema);
    //     const end = performance.now();

    //     console.log(`Generated large complex structure in ${end - start}ms`);
    //     assert(result.id);
    //     assert(result.data.length >= 100);
    //     assert(Object.keys(result.data[0].metadata).length > 0);
    // });
});
