import { Faker, faker, en } from '@std/faker';
import RandExp from '@std/randexp';
import {
    type AnyZodObject,
    util,
    z,
    type ZodRecord,
    type ZodString,
    type ZodType,
    type ZodTypeAny,
} from '@std/zod';
import {
    type MockeryMapper,
    mockeryMapper as defaultMapper,
} from './zod-mockery-map.ts';

export class ZodMockError extends Error {}

type FakerClass = typeof faker;

function depthControlled<T extends ZodTypeAny>(
    parseFunction: (zodRef: T, options: GenerateMockOptions) => any
) {
    return function (zodRef: T, options: GenerateMockOptions) {
        const defaultOptions: GenerateMockOptions = {
            maxDepth: 10,
            currentDepth: 0,
            ...options
        };

        if (defaultOptions.currentDepth >= defaultOptions.maxDepth) {
            // Return sensible defaults when max depth is reached
            if (zodRef instanceof z.ZodObject) return {};
            if (zodRef instanceof z.ZodArray) return [];
            if (zodRef instanceof z.ZodSet) return new Set();
            if (zodRef instanceof z.ZodMap) return new Map();
            if (zodRef instanceof z.ZodLazy) return undefined;
            return undefined;
        }

        const newOptions = { ...defaultOptions, currentDepth: defaultOptions.currentDepth + 1 };

        return parseFunction(zodRef, newOptions);
    };
}

type WorkerFunction = (zodRef: any, options: GenerateMockOptions) => any;

const parseObject = depthControlled((
    zodRef: z.ZodObject<any>,
    options: GenerateMockOptions
): Record<string, any> => {
    return Object.keys(zodRef.shape).reduce((carry, key) => ({
        ...carry,
        [key]: generateMock(zodRef.shape[key], {
            ...options,
            keyName: key,
            backupMocks: options.backupMocks,
        }),
    }), {});
});

function parseRecord<
    Key extends ZodType<string | number | symbol, any, any> = ZodString,
    Value extends ZodTypeAny = ZodTypeAny,
>(zodRef: ZodRecord<Key, Value>, options?: GenerateMockOptions) {
    const recordKeysLength = options?.recordKeysLength || 1;

    return new Array(recordKeysLength).fill(null).reduce((prev) => {
        return {
            ...prev,
            [generateMock(zodRef.keySchema, options)]: generateMock(
                zodRef.valueSchema,
                options
            ),
        };
    }, {});
}

type FakerFunction = () => string | number | boolean | Date;

function findMatchingFaker(
    keyName: string,
    fakerOption?: FakerClass,
    mockeryMapper: MockeryMapper = defaultMapper,
): undefined | FakerFunction | void {
    const fakerInstance = fakerOption || faker;
    const lowerCaseKeyName = keyName.toLowerCase();
    const withoutDashesUnderscores = lowerCaseKeyName.replace(/_|-/g, '');
    let fnName: string | undefined = undefined;

    // Well, all the dep warnings are going to require mapping
    const mapped = mockeryMapper(keyName, fakerInstance);
    if (mapped) return mapped;

    const sectionName = Object.keys(fakerInstance).find((sectionKey) => {
        return Object.keys(
            fakerInstance[sectionKey as keyof FakerClass] || {},
        ).find((fnKey) => {
            const lower = fnKey.toLowerCase();
            fnName =
                lower === lowerCaseKeyName || lower === withoutDashesUnderscores
                    ? keyName
                    : undefined;

            // Skipping depreciated items
            // const depreciated: Record<string, string[]> = {
            //   random: ['image', 'number', 'float', 'uuid', 'boolean', 'hexaDecimal'],
            // };
            // if (
            //   Object.keys(depreciated).find((key) =>
            //     key === sectionKey
            //       ? depreciated[key].find((fn) => fn === fnName)
            //       : false
            //   )
            // ) {
            //   return undefined;
            // }

            if (fnName) {
                // TODO: it would be good to clean up these type castings
                const fn = fakerInstance[sectionKey as keyof FakerClass]?.[
                    fnName as never
                ] as any;

                if (typeof fn === 'function') {
                    try {
                        // some Faker functions, such as `faker.mersenne.seed`, are known to throw errors if called
                        // with incorrect parameters
                        const mock = fn();
                        return typeof mock === 'string' ||
                                typeof mock === 'number' ||
                                typeof mock === 'boolean' ||
                                mock instanceof Date
                            ? fnName
                            : undefined;
                    } catch (_error) {
                        // do nothing. undefined will be returned eventually.
                    }
                }
            }
            return undefined;
        });
    }) as keyof FakerClass;
    if (sectionName && fnName) {
        const section = fakerInstance[sectionName];
        return section ? section[fnName] : undefined;
    }
}

function parseString(
    zodRef: z.ZodString,
    options?: GenerateMockOptions,
): string {
    const fakerInstance = options?.faker || faker;
    const { checks = [] } = zodRef._def;

    const regexCheck = checks.find((check) => check.kind === 'regex');
    if (regexCheck && 'regex' in regexCheck) {
        const generator = new RandExp(regexCheck.regex);
        generator.randInt = (min: number, max: number) =>
            fakerInstance.number.int({ min, max });
        const max = checks.find((check) => check.kind === 'max');
        if (max && 'value' in max && typeof max.value === 'number') {
            generator.max = max.value;
        }
        const genRegString = generator.gen();
        return genRegString;
    }

    const lowerCaseKeyName = options?.keyName?.toLowerCase();
    // Prioritize user provided generators.
    if (options?.keyName && options.stringMap) {
        const generator = options.stringMap[options.keyName];
        if (generator) {
            return generator();
        }
    }
    const stringOptions: {
        min?: number;
        max?: number;
    } = {};

    checks.forEach((item) => {
        switch (item.kind) {
            case 'min':
                stringOptions.min = item.value;
                break;
            case 'max':
                stringOptions.max = item.value;
                break;
            case 'length':
                stringOptions.min = item.value;
                stringOptions.max = item.value;
                break;
        }
    });

    const sortedStringOptions = {
        ...stringOptions,
    };

    // avoid Max {Max} should be greater than min {Min}
    if (
        sortedStringOptions.min &&
        sortedStringOptions.max &&
        sortedStringOptions.min > sortedStringOptions.max
    ) {
        const temp = sortedStringOptions.min;
        sortedStringOptions.min = sortedStringOptions.max;
        sortedStringOptions.max = temp;
    }

    const targetStringLength = fakerInstance.number.int(sortedStringOptions);
    /**
     * Returns a random lorem word using `faker.lorem.word(length)`.
     * This method can return undefined for large word lengths. If undefined is returned
     * when specifying a large word length, will return `faker.lorem.word()` instead.
     */
    const defaultGenerator = () =>
        targetStringLength > 10
            ? fakerInstance.lorem.word()
            : fakerInstance.lorem.word({ length: targetStringLength });
    const dateGenerator = () => fakerInstance.date.recent().toISOString();
    const stringGenerators = {
        default: defaultGenerator,
        email: fakerInstance.internet.email,
        uuid: fakerInstance.string.uuid,
        uid: fakerInstance.string.uuid,
        url: fakerInstance.internet.url,
        name: fakerInstance.person.fullName,
        date: dateGenerator,
        dateTime: dateGenerator,
        colorHex: fakerInstance.internet.color,
        color: fakerInstance.internet.color,
        backgroundColor: fakerInstance.internet.color,
        textShadow: fakerInstance.internet.color,
        textColor: fakerInstance.internet.color,
        textDecorationColor: fakerInstance.internet.color,
        borderColor: fakerInstance.internet.color,
        borderTopColor: fakerInstance.internet.color,
        borderRightColor: fakerInstance.internet.color,
        borderBottomColor: fakerInstance.internet.color,
        borderLeftColor: fakerInstance.internet.color,
        borderBlockStartColor: fakerInstance.internet.color,
        borderBlockEndColor: fakerInstance.internet.color,
        borderInlineStartColor: fakerInstance.internet.color,
        borderInlineEndColor: fakerInstance.internet.color,
        columnRuleColor: fakerInstance.internet.color,
        outlineColor: fakerInstance.internet.color,
        phoneNumber: fakerInstance.phone.number,
    };

    const stringType = (Object.keys(stringGenerators).find(
        (genKey) =>
            genKey.toLowerCase() === lowerCaseKeyName ||
            checks.find((item) =>
                item.kind.toUpperCase() === genKey.toUpperCase()
            ),
    ) as keyof typeof stringGenerators) || null;

    let generator: FakerFunction = defaultGenerator;

    if (stringType) {
        generator = stringGenerators[stringType];
    } else {
        const foundFaker = options?.keyName
            ? findMatchingFaker(
                options?.keyName,
                options.faker,
                options.mockeryMapper,
            )
            : undefined;
        if (foundFaker) {
            generator = foundFaker;
        }
    }

    // it's possible for a zod schema to be defined with a
    // min that is greater than the max. While that schema
    // will never parse without producing errors, we will prioritize
    // the max value because exceeding it represents a potential security
    // vulnerability (buffer overflows).
    let val = generator().toString();
    const delta = targetStringLength - val.length;
    if (stringOptions.min != null && val.length < stringOptions.min) {
        val = val + fakerInstance.string.alpha({ length: delta });
    }

    return val.slice(0, stringOptions.max);
}

function parseBoolean(zodRef: z.ZodBoolean, options?: GenerateMockOptions) {
    const fakerInstance = options?.faker || faker;
    return fakerInstance.datatype.boolean();
}

function parseDate(zodRef: z.ZodDate, options?: GenerateMockOptions) {
    const fakerInstance = options?.faker || faker;
    const { checks = [] } = zodRef._def;
    let min: Date | undefined;
    let max: Date | undefined;

    checks.forEach((item: any) => {
        if (item.kind === 'min' || item.kind === 'max') {
            const value = item.value;
            if (value instanceof Date || (typeof value === 'number' && !isNaN(value))) {
                const dateValue = value instanceof Date ? value : new Date(value);
                if (item.kind === 'min') {
                    min = dateValue;
                } else {
                    max = dateValue;
                }
            } else {
                console.warn(`Invalid ${item.kind} date value: ${value}`);
            }
        }
    });

    try {
        if (min !== undefined && max !== undefined) {
            if (min > max) {
                return undefined
            }
            return fakerInstance.date.between({ from: min, to: max })
        } else if (min !== undefined) {
            return fakerInstance.date.soon({ refDate: min });
        } else if (max !== undefined) {
            return fakerInstance.date.recent({ refDate: max });
        } else {
            return fakerInstance.date.recent({ days: 30 });
        }
    } catch (error) {
        console.error('Error generating date:', error);
        return undefined // Fallback to a recent date within the last 30 days
    }
}

function parseNumber(
    zodRef: z.ZodNumber,
    options?: GenerateMockOptions,
): number {
    const fakerInstance = options?.faker || faker;
    const { checks = [] } = zodRef._def;
    const fakerOptions: any = {};

    checks.forEach((item) => {
        switch (item.kind) {
            case 'int':
                break;
            case 'min':
                fakerOptions.min = item.value;
                break;
            case 'max':
                fakerOptions.max = item.value;
                break;
        }
    });
    return fakerInstance.number.int(fakerOptions);
}

function parseOptional(
    zodRef: z.ZodOptional<ZodTypeAny> | z.ZodNullable<ZodTypeAny>,
    options?: GenerateMockOptions,
) {
    return generateMock<ZodTypeAny>(zodRef.unwrap(), options)
}

const parseArray = depthControlled((zodRef: z.ZodArray<any>, options?: GenerateMockOptions) => {
    const fakerInstance = options?.faker || faker;
    let min = zodRef._def.minLength?.value ?? zodRef._def.exactLength?.value ?? 0;
    const max = zodRef._def.maxLength?.value ?? zodRef._def.exactLength?.value ?? 10;

    if (min > max) {
        min = max;
    }
    const targetLength = fakerInstance.number.int({ min, max });
    const results: any[] = [];
    for (let index = 0; index < targetLength; index++) {
        let value;
        if (zodRef.element._def.typeName === 'ZodUndefined' && options?.backupMocks?.ZodUndefined) {
            value = options.backupMocks.ZodUndefined(zodRef.element, options);
        } else {
            value = generateMock(zodRef.element, {
                ...options,
                backupMocks: options?.backupMocks
            });
        }
        results.push(value);
    }
    return results;
});

const parseSet = depthControlled((zodRef: z.ZodSet<never>, options?: GenerateMockOptions) => {
    const fakerInstance = options?.faker || faker;
    let min = zodRef._def.minSize?.value != null ? zodRef._def.minSize.value : 1;
    const max = zodRef._def.maxSize?.value != null ? zodRef._def.maxSize.value : 5;

    if (min > max) {
        min = max;
    }
    const targetLength = fakerInstance.number.int({ min, max });
    const results = new Set<ZodTypeAny>();
    while (results.size < targetLength) {
        results.add(generateMock<ZodTypeAny>(zodRef._def.valueType, options));
    }

    return results;
});

const parseMap = depthControlled((zodRef: z.ZodMap<never>, options?: GenerateMockOptions) => {
    const targetLength = options?.mapEntriesLength ?? 1;
    const results = new Map<ZodTypeAny, ZodTypeAny>();

    while (results.size < targetLength) {
        results.set(
            generateMock<ZodTypeAny>(zodRef._def.keyType, options),
            generateMock<ZodTypeAny>(zodRef._def.valueType, options)
        );
    }
    return results;
});

function parseEnum(
    zodRef: z.ZodEnum<never> | z.ZodNativeEnum<never>,
    options?: GenerateMockOptions,
) {
    const fakerInstance = options?.faker || faker;
    const values = zodRef._def.values as Array<z.infer<typeof zodRef>>;
    return fakerInstance.helpers.arrayElement(values);
}

function parseDiscriminatedUnion(
    zodRef: z.ZodDiscriminatedUnion<never, any>,
    options?: GenerateMockOptions,
) {
    const fakerInstance = options?.faker || faker;
    // Map the options to various possible union cases
    const potentialCases = [...zodRef._def.options.values()];
    const mocked = fakerInstance.helpers.arrayElement(potentialCases);
    return generateMock(mocked, options);
}

function parseNativeEnum(
    zodRef: z.ZodNativeEnum<never>,
    options?: GenerateMockOptions,
) {
    const fakerInstance = options?.faker || faker;
    const values = util.getValidEnumValues(zodRef.enum);
    return fakerInstance.helpers.arrayElement(values);
}

function parseLiteral(zodRef: z.ZodLiteral<any>) {
    return zodRef._def.value;
}

function parseTransform(
    zodRef: z.ZodTransformer<never> | z.ZodEffects<never>,
    options?: GenerateMockOptions,
) {
    const input = generateMock(zodRef._def.schema, options);

    const effect = zodRef._def.effect.type === 'transform'
        ? zodRef._def.effect
        : { transform: () => input };

    return effect.transform(input, { addIssue: () => undefined, path: [] });
}

function parseUnion(
    zodRef: z.ZodUnion<Readonly<[ZodTypeAny, ...ZodTypeAny[]]>>,
    options?: GenerateMockOptions,
) {
    const fakerInstance = options?.faker || faker;
    // Map the options to various possible mock values
    const potentialCases = [...zodRef._def.options.values()];
    const mocked = fakerInstance.helpers.arrayElement(potentialCases);
    return generateMock(mocked, options);
}

function parseZodIntersection(
    zodRef: z.ZodIntersection<ZodTypeAny, ZodTypeAny>,
    options?: GenerateMockOptions,
) {
    const left = generateMock(zodRef._def.left, options);
    const right = generateMock(zodRef._def.right, options);

    return Object.assign(left, right);
}
function parseZodTuple(
    zodRef: z.ZodTuple<[], never>,
    options?: GenerateMockOptions,
) {
    const results: ZodTypeAny[] = [];
    zodRef._def.items.forEach((def) => {
        results.push(generateMock(def, options));
    });

    if (zodRef._def.rest !== null) {
        const next = parseArray(z.array(zodRef._def.rest), options);
        results.push(...(next ?? []));
    }
    return results;
}

function parseZodFunction(
    zodRef: z.ZodFunction<z.ZodTuple<any, any>, ZodTypeAny>,
    options?: GenerateMockOptions,
) {
    return function zodMockFunction() {
        return generateMock(zodRef._def.returns, options);
    };
}

function parseZodDefault(
    zodRef: z.ZodDefault<ZodTypeAny>,
    options?: GenerateMockOptions,
) {
    const fakerInstance = options?.faker || faker;
    // Use the default value 50% of the time
    if (fakerInstance.datatype.boolean()) {
        return zodRef._def.defaultValue();
    } else {
        return generateMock(zodRef._def.innerType, options);
    }
}

function parseZodPromise(
    zodRef: z.ZodPromise<ZodTypeAny>,
    options?: GenerateMockOptions,
) {
    return Promise.resolve(generateMock(zodRef._def.type, options));
}

function parseBranded(
    zodRef: z.ZodBranded<ZodTypeAny, never>,
    options?: GenerateMockOptions,
) {
    return generateMock(zodRef.unwrap(), options);
}

function parseLazy(
    zodRef: z.ZodLazy<ZodTypeAny>,
    options?: GenerateMockOptions
) {
    return generateMock(zodRef._def.getter(), options);
}

function parseUuid(zodRef: z.ZodString, options: GenerateMockOptions): string {
    return faker.string.uuid();
}

// function parseEnum(zodRef: z.ZodEnum<any>, options: GenerateMockOptions) {
//     return faker.helpers.arrayElement(zodRef._def.values);
// }

// function parseUnion(zodRef: z.ZodUnion<any>, options: GenerateMockOptions) {
//     const unionType = faker.helpers.arrayElement(zodRef._def.options);
//     return generateMock(unionType, options);
// }

// function parseRecord(zodRef: z.ZodRecord<any, any>, options: GenerateMockOptions) {
//     const length = faker.number.int({ min: 1, max: 3 });
//     return Array.from({ length }).reduce((acc) => {
//         const key = generateMock(zodRef.keySchema, options);
//         acc[key] = generateMock(zodRef.valueSchema, options);
//         return acc;
//     }, {});
// }

const workerMap: Record<string, (zodRef: any, options: GenerateMockOptions) => any> = {
    ZodObject: parseObject,
    ZodRecord: depthControlled(parseRecord),
    ZodArray: parseArray,
    ZodSet: parseSet,
    ZodMap: parseMap,
    ZodLazy: depthControlled(parseLazy),
    ZodUnion: parseUnion,                  
    ZodIntersection: parseZodIntersection,
    ZodDiscriminatedUnion: parseDiscriminatedUnion,
    ZodOptional: parseOptional, 
    ZodNullable: parseOptional, 
    ZodTransformer: parseTransform, 
    ZodEffects: parseTransform, 
    ZodFunction: parseZodFunction, 
    ZodPromise: parseZodPromise, 
    ZodTuple: parseZodTuple,    
    ZodString: parseString,
    ZodNumber: parseNumber,
    ZodBigInt: parseNumber,
    ZodBoolean: parseBoolean,
    ZodDate: parseDate,
    ZodEnum: parseEnum,
    ZodNativeEnum: parseNativeEnum,
    ZodLiteral: parseLiteral,
    ZodBranded: parseBranded,
    ZodNull: () => null,
    ZodNaN: () => undefined,
    ZodDefault: parseZodDefault,
    ZodVoid: () => undefined,
    ZodUndefined: () => undefined,
    ZodUuid: parseUuid
  };
  

type WorkerKeys = keyof typeof workerMap;

export interface GenerateMockOptions {
    keyName?: string;
    /**
     * Note: callback functions are not called with any
     * parameters at this time.
     */
    stringMap?: Record<string, (...args: any[]) => string>;

    /**
     * This is a function that can be provided to match a key name with a specific mock
     * Otherwise it searches the faker library for a matching function name
     */
    mockeryMapper?: MockeryMapper;

    /**
     * This is a mapping of field name to mock generator function.
     * This mapping can be used to provide backup mock
     * functions for Zod types not yet implemented in {@link WorkerKeys}.
     * The functions in this map will only be used if this library
     * is unable to find an appropriate mocking function to use.
     */
    backupMocks?: {
        [key: string]: (schema: ZodTypeAny, options: GenerateMockOptions) => any;
    };

    /**
     * How many entries to create for records
     */
    recordKeysLength?: number;

    /**
     * How many entries to create for Maps
     */
    mapEntriesLength?: number;

    /**
     * Set to true to throw an exception instead of returning undefined when encountering an unknown `ZodType`
     */
    throwOnUnknownType?: boolean;

    /**
     * Set a seed for random generation
     */
    seed?: number | number[];

    /**
     * Faker class instance for mocking
     */
    faker?: FakerClass;

    /**  
     * Current depth in which a generator has created schemas for
    */
    currentDepth?: number;

    /**
     * Max depth in at which point we will automatically return 
     */
    maxDepth?: number;
}

export function generateMock<T extends ZodTypeAny>(
    schema: T,
    options: GenerateMockOptions = {}
): z.infer<T> {
    const defaultOptions: GenerateMockOptions = {
        maxDepth: 10,
        currentDepth: 0,
        faker: new Faker({ locale: [en] }), // Use a new Faker instance by default
        ...options
    };

    if (defaultOptions.seed !== undefined) {
        defaultOptions.faker.seed(defaultOptions.seed);
    }
  
    try {
        if (schema._def.typeName === 'ZodUndefined' && defaultOptions.backupMocks?.ZodUndefined) {
            return defaultOptions.backupMocks.ZodUndefined(schema, defaultOptions);
        }

        const mockFunction = workerMap[schema._def.typeName];
        if (mockFunction) {
            // Pass the backupMocks and maxDepth to nested calls
            return mockFunction(schema, {
                ...defaultOptions,
                backupMocks: defaultOptions.backupMocks,
                maxDepth: defaultOptions.maxDepth,
            });
        } else if (defaultOptions.backupMocks?.[schema._def.typeName]) {
            return defaultOptions.backupMocks[schema._def.typeName](schema, defaultOptions);
        } else if (defaultOptions.throwOnUnknownType) {
            throw new ZodMockError(schema._def.typeName);
        }
        return undefined;
    }
    catch (err) {
        if (err instanceof ZodMockError) {
            throw err;
        }
        console.error(err);
        return undefined;
    }
}
