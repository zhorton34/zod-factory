    import { Faker, faker, en } from '@std/faker';
    import RandExp from '@std/randexp';
    import { z, type ZodTypeAny } from '@std/zod';
    import {
        type MockeryMapper,
        mockeryMapper as defaultMapper,
    } from './zod-mockery-map.ts';

    export class ZodMockError extends Error {}

    type FakerClass = typeof faker;

    function depthControlled<T extends ZodTypeAny>(
        parseFunction: (zodRef: T, options: GenerateMockOptions) => unknown
    ) {
        return function (zodRef: T, options: GenerateMockOptions) {
            const defaultOptions: GenerateMockOptions = {
                maxDepth: 10,
                currentDepth: 0,
                ...options
            };

            if ((defaultOptions.currentDepth ?? 0) >= (defaultOptions.maxDepth ?? 0)) {
                if (zodRef instanceof z.ZodObject) return {};
                if (zodRef instanceof z.ZodArray) return [];
                if (zodRef instanceof z.ZodSet) return new Set();
                if (zodRef instanceof z.ZodMap) return new Map();
                if (zodRef instanceof z.ZodLazy) return undefined;
                return undefined;
            }

            const newOptions = { ...defaultOptions, currentDepth: (defaultOptions.currentDepth ?? 0) + 1 };

            return parseFunction(zodRef, newOptions);
        };
    }

    const parseObject = depthControlled((
        zodRef: z.ZodObject<Record<string, ZodTypeAny>>,
        options: GenerateMockOptions
    ): Record<string, ZodTypeAny> => {
        return Object.keys(zodRef.shape).reduce((carry, key) => ({
            ...carry,
            [key]: generateMock(zodRef.shape[key], {
                ...options,
                keyName: key,
                backupMocks: options.backupMocks,
            }),
        }), {});
    });

    function parseRecord(
        zodRef: z.ZodRecord,
        options?: GenerateMockOptions
    ) {
        const recordKeysLength = options?.recordKeysLength || 1;
        const def = (zodRef as unknown as { _zod: { def: { keyType: ZodTypeAny; valueType: ZodTypeAny } } })._zod.def;

        return new Array(recordKeysLength).fill(null).reduce((prev) => {
            return {
                ...prev,
                [String(generateMock(def.keyType, options))]: generateMock(
                    def.valueType,
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

                if (fnName) {
                    // TODO: it would be good to clean up these type castings
                    const fn = fakerInstance[sectionKey as keyof FakerClass]?.[
                        fnName as never
                    ] as unknown;

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

        // In Zod 4, checks are accessed via _zod.def.checks and direct properties
        const zodAny = zodRef as unknown as {
            minLength: number | null;
            maxLength: number | null;
            format: string | null;
            _zod: { def: { checks?: Array<{ _zod: { def: { check: string; pattern?: RegExp; format?: string; minimum?: number } } }> }; bag?: Record<string, unknown> };
        };

        const checks = zodAny._zod.def.checks || [];

        // Check for regex
        const regexCheck = checks.find((check) => check._zod?.def?.format === 'regex');
        if (regexCheck && regexCheck._zod?.def?.pattern) {
            const generator = new RandExp(regexCheck._zod.def.pattern);
            generator.randInt = (min: number, max: number) =>
                fakerInstance.number.int({ min, max });
            if (zodAny.maxLength != null) {
                generator.max = zodAny.maxLength;
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

        if (zodAny.minLength != null) {
            stringOptions.min = zodAny.minLength;
        }
        if (zodAny.maxLength != null) {
            stringOptions.max = zodAny.maxLength;
        }

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

        // In Zod 4, format is a direct property on ZodString (e.g. "email", "uuid", "url", "datetime")
        const format = zodAny.format;

        const stringGenerators: Record<string, FakerFunction> = {
            default: defaultGenerator,
            email: fakerInstance.internet.email,
            uuid: fakerInstance.string.uuid,
            uid: fakerInstance.string.uuid,
            url: fakerInstance.internet.url,
            name: fakerInstance.person.fullName,
            date: dateGenerator,
            dateTime: dateGenerator,
            datetime: dateGenerator,
            colorHex: fakerInstance.color.rgb,
            color: fakerInstance.color.rgb,
            backgroundColor: fakerInstance.color.rgb,
            textShadow: fakerInstance.color.rgb,
            textColor: fakerInstance.color.rgb,
            textDecorationColor: fakerInstance.color.rgb,
            borderColor: fakerInstance.color.rgb,
            borderTopColor: fakerInstance.color.rgb,
            borderRightColor: fakerInstance.color.rgb,
            borderBottomColor: fakerInstance.color.rgb,
            borderLeftColor: fakerInstance.color.rgb,
            borderBlockStartColor: fakerInstance.color.rgb,
            borderBlockEndColor: fakerInstance.color.rgb,
            borderInlineStartColor: fakerInstance.color.rgb,
            borderInlineEndColor: fakerInstance.color.rgb,
            columnRuleColor: fakerInstance.color.rgb,
            outlineColor: fakerInstance.color.rgb,
            phoneNumber: fakerInstance.phone.number,
        };

        // Match by format (Zod 4 string format like "email", "uuid", "url", "datetime")
        // or by key name
        let stringType: string | null = null;

        if (format) {
            stringType = (Object.keys(stringGenerators).find(
                (genKey) => genKey.toLowerCase() === format.toLowerCase()
            )) || null;
        }

        if (!stringType) {
            stringType = (Object.keys(stringGenerators).find(
                (genKey) => genKey.toLowerCase() === lowerCaseKeyName
            )) || null;
        }

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

    function parseBoolean(_zodRef: z.ZodBoolean, options?: GenerateMockOptions) {
        const fakerInstance = options?.faker || faker;
        return fakerInstance.datatype.boolean();
    }

    function parseDate(zodRef: z.ZodDate, options?: GenerateMockOptions) {
        const fakerInstance = options?.faker || faker;

        // In Zod 4, date constraints are in _zod.bag
        const bag = (zodRef as unknown as { _zod: { bag?: { minimum?: Date; maximum?: Date } } })._zod?.bag || {};
        const min: Date | undefined = bag.minimum instanceof Date ? bag.minimum : undefined;
        const max: Date | undefined = bag.maximum instanceof Date ? bag.maximum : undefined;

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

        // In Zod 4, number constraints are direct properties
        const zodAny = zodRef as unknown as {
            minValue: number;
            maxValue: number;
            isInt: boolean;
        };

        const fakerOptions: { min?: number; max?: number } = {};
        if (zodAny.minValue !== -Infinity) {
            fakerOptions.min = zodAny.minValue;
        }
        if (zodAny.maxValue !== Infinity) {
            fakerOptions.max = zodAny.maxValue;
        }

        return fakerInstance.number.int(fakerOptions);
    }

    function parseOptional(
        zodRef: z.ZodOptional<ZodTypeAny> | z.ZodNullable<ZodTypeAny>,
        options?: GenerateMockOptions,
    ) {
        return generateMock<ZodTypeAny>(zodRef.unwrap(), options)
    }

    const parseArray = depthControlled((zodRef: z.ZodArray<ZodTypeAny>, options?: GenerateMockOptions) => {
        const fakerInstance = options?.faker || faker;

        // In Zod 4, array constraints are in _zod.bag
        const bag = (zodRef as unknown as { _zod: { bag?: { minimum?: number; maximum?: number; length?: number } } })._zod?.bag || {};
        let min = bag.minimum ?? bag.length ?? 1;
        const max = bag.maximum ?? bag.length ?? 10;

        if (min > max) {
            min = max;
        }
        const targetLength = fakerInstance.number.int({ min, max });
        const results: unknown[] = [];
        const elementType = getDefType(zodRef.element);
        for (let index = 0; index < targetLength; index++) {
            let value;
            if (elementType === 'undefined' && options?.backupMocks?.ZodUndefined) {
                value = options.backupMocks.ZodUndefined(zodRef.element, options as GenerateMockOptions);
            } else {
                value = generateMock(zodRef.element, {
                    ...options,
                    backupMocks: options?.backupMocks
                } as GenerateMockOptions);
            }
            results.push(value);
        }
        return results;
    });

    const parseSet = depthControlled((zodRef: z.ZodSet<never>, options?: GenerateMockOptions) => {
        const fakerInstance = options?.faker || faker;

        // In Zod 4, set constraints are in _zod.bag
        const bag = (zodRef as unknown as { _zod: { bag?: { minimum?: number; maximum?: number } } })._zod?.bag || {};
        let min = bag.minimum ?? 1;
        const max = bag.maximum ?? 5;

        if (min > max) {
            min = max;
        }
        const targetLength = fakerInstance.number.int({ min, max });
        const valueType = (zodRef as unknown as { _zod: { def: { valueType: ZodTypeAny } } })._zod.def.valueType;
        const results = new Set<unknown>();
        while (results.size < targetLength) {
            results.add(generateMock(valueType as ZodTypeAny, options as GenerateMockOptions));
        }

        return results;
    });

    const parseMap = depthControlled((zodRef: z.ZodMap<never>, options?: GenerateMockOptions) => {
        const targetLength = options?.mapEntriesLength ?? 1;
        const def = (zodRef as unknown as { _zod: { def: { keyType: ZodTypeAny; valueType: ZodTypeAny } } })._zod.def;
        const results = new Map<unknown, unknown>();

        while (results.size < targetLength) {
            results.set(
                generateMock(def.keyType as ZodTypeAny, options as GenerateMockOptions),
                generateMock(def.valueType as ZodTypeAny, options as GenerateMockOptions)
            );
        }
        return results;
    });

    function parseEnum(
        zodRef: z.ZodEnum<never>,
        options?: GenerateMockOptions,
    ) {
        const fakerInstance = options?.faker || faker;
        // In Zod 4, enum values are in .options (array)
        const values = (zodRef as unknown as { options: Array<z.infer<typeof zodRef>> }).options;
        return fakerInstance.helpers.arrayElement(values);
    }

    function parseDiscriminatedUnion(
        zodRef: z.ZodDiscriminatedUnion,
        options?: GenerateMockOptions,
    ) {
        const fakerInstance = options?.faker || faker;
        // In Zod 4, discriminated union options is an array in _zod.def.options
        const def = (zodRef as unknown as { _zod: { def: { options: ZodTypeAny[] } } })._zod.def;
        const potentialCases = def.options;
        const mocked = fakerInstance.helpers.arrayElement(potentialCases);
        return generateMock(mocked, options);
    }

    function parseNativeEnum(
        zodRef: z.ZodEnum<never>,
        options?: GenerateMockOptions,
    ): unknown {
        const fakerInstance = options?.faker || faker;
        // In Zod 4, z.nativeEnum() returns a ZodEnum-like with .enum property
        const enumObj = (zodRef as unknown as { enum: Record<string, string | number> }).enum;
        // Extract valid enum values (filter reverse mappings for numeric enums)
        const values = Object.entries(enumObj)
            .filter(([_key, value]) =>
                typeof value === 'number' || (typeof value === 'string' && !(value in enumObj))
            )
            .map(([, v]) => v);
        return fakerInstance.helpers.arrayElement(values);
    }

    // deno-lint-ignore no-explicit-any
    function parseLiteral(zodRef: z.ZodLiteral<any>): unknown {
        // In Zod 4, literal value is accessed via .value getter
        return (zodRef as unknown as { value: unknown }).value;
    }

    function parseTransform(
        zodRef: z.ZodPipe<ZodTypeAny, ZodTypeAny>,
        options?: GenerateMockOptions,
    ): unknown {
        // In Zod 4, .transform() returns ZodPipe with _zod.def.in and _zod.def.out (ZodTransform)
        const def = (zodRef as unknown as { _zod: { def: { in: ZodTypeAny; out: { _zod: { def: { transform: (input: unknown) => unknown } } } } } })._zod.def;
        const input = generateMock(def.in, options);

        if (def.out && def.out._zod?.def?.transform) {
            return def.out._zod.def.transform(input);
        }

        return input;
    }

    function parseUnion(
        zodRef: z.ZodUnion<readonly [ZodTypeAny, ...ZodTypeAny[]]>,
        options?: GenerateMockOptions,
    ): unknown {
        const fakerInstance = options?.faker || faker;
        // In Zod 4, union options is a plain array in _zod.def.options
        const def = (zodRef as unknown as { _zod: { def: { options: ZodTypeAny[] } } })._zod.def;
        const potentialCases = def.options;
        const mocked = fakerInstance.helpers.arrayElement(potentialCases);
        return generateMock(mocked, options);
    }

    function parseZodIntersection(
        zodRef: z.ZodIntersection<ZodTypeAny, ZodTypeAny>,
        options?: GenerateMockOptions,
    ): unknown {
        // In Zod 4, intersection uses _zod.def.left and _zod.def.right
        const def = (zodRef as unknown as { _zod: { def: { left: ZodTypeAny; right: ZodTypeAny } } })._zod.def;
        const left = generateMock(def.left, options);
        const right = generateMock(def.right, options);

        return Object.assign(left as object, right as object);
    }

    function parseZodTuple(
        zodRef: z.ZodTuple<[], never>,
        options?: GenerateMockOptions,
    ): unknown[] {
        // In Zod 4, tuple uses _zod.def.items and _zod.def.rest
        const def = (zodRef as unknown as { _zod: { def: { items: ZodTypeAny[]; rest: ZodTypeAny | null } } })._zod.def;
        const results: unknown[] = [];
        def.items.forEach((itemDef) => {
            results.push(generateMock(itemDef, options));
        });

        if (def.rest !== null) {
            const next = parseArray(z.array(def.rest), options as GenerateMockOptions);
            if (Array.isArray(next)) {
                results.push(...next);
            }
        }
        return results;
    }

    function parseZodFunction(
        zodRef: ZodTypeAny,
        options?: GenerateMockOptions,
    ) {
        // In Zod 4, function uses _zod.def.output
        const def = (zodRef as unknown as { _zod: { def: { output: ZodTypeAny } } })._zod.def;
        return function zodMockFunction() {
            return generateMock(def.output, options);
        };
    }

    function parseZodDefault(
        zodRef: z.ZodDefault<ZodTypeAny>,
        options?: GenerateMockOptions,
    ) {
        const fakerInstance = options?.faker || faker;
        // In Zod 4, defaultValue is a direct value (not a function), innerType is in _zod.def
        const def = (zodRef as unknown as { _zod: { def: { defaultValue: unknown; innerType: ZodTypeAny } } })._zod.def;
        // Use the default value 50% of the time
        if (fakerInstance.datatype.boolean()) {
            return def.defaultValue;
        } else {
            return generateMock(def.innerType, options);
        }
    }

    function parseZodPromise(
        zodRef: z.ZodPromise<ZodTypeAny>,
        options?: GenerateMockOptions,
    ) {
        // In Zod 4, promise uses _zod.def.innerType
        const def = (zodRef as unknown as { _zod: { def: { innerType: ZodTypeAny } } })._zod.def;
        return Promise.resolve(generateMock(def.innerType, options));
    }

    function parseLazy(
        zodRef: z.ZodLazy<ZodTypeAny>,
        options?: GenerateMockOptions
    ) {
        // In Zod 4, lazy uses _zod.def.getter
        const def = (zodRef as unknown as { _zod: { def: { getter: () => ZodTypeAny } } })._zod.def;
        return generateMock(def.getter(), options);
    }

    function parseCustom(
        zodRef: ZodTypeAny,
        options?: GenerateMockOptions,
    ): unknown {
        // z.custom() and z.any() in Zod 4
        const defType = getDefType(zodRef);

        // Check for direct type backup mock
        if (options?.backupMocks?.[defType]) {
            return options.backupMocks[defType](zodRef, options);
        }
        // Map defType to legacy backup mock key names
        const legacyKeyMap: Record<string, string> = {
            'any': 'ZodAny',
            'custom': 'ZodCustom',
            'unknown': 'ZodUnknown',
        };
        const legacyKey = legacyKeyMap[defType];
        if (legacyKey && options?.backupMocks?.[legacyKey]) {
            return options.backupMocks[legacyKey](zodRef, options);
        }
        // Fall back to ZodAny backup for any custom/any/unknown type
        if (options?.backupMocks?.ZodAny) {
            return options.backupMocks.ZodAny(zodRef, options);
        }
        if (options?.throwOnUnknownType) {
            throw new ZodMockError(defType);
        }
        return undefined;
    }

    /**
     * Get the type string from a Zod schema's internal def
     */
    function getDefType(schema: ZodTypeAny): string {
        return (schema as unknown as { _zod: { def: { type: string } } })._zod.def.type;
    }

    /**
     * Determine the mock handler for a schema using instanceof checks (Zod 4)
     */
    function getMockHandler(schema: ZodTypeAny): ((zodRef: unknown, options: GenerateMockOptions) => unknown) | undefined {
        // In Zod 4, transforms produce ZodPipe wrapping ZodTransform
        // Check ZodPipe first since it wraps transforms
        if (schema instanceof z.ZodPipe) {
            // Check if the out is a ZodTransform
            const def = (schema as unknown as { _zod: { def: { out: ZodTypeAny } } })._zod.def;
            if (def.out instanceof z.ZodTransform) {
                return parseTransform as (zodRef: unknown, options: GenerateMockOptions) => unknown;
            }
        }

        if (schema instanceof z.ZodObject) return depthControlled(parseObject) as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodRecord) return parseRecord as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodArray) return parseArray as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodSet) return parseSet as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodMap) return parseMap as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodLazy) return depthControlled(parseLazy) as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodUnion) {
            // Check for discriminated union (has discriminator field)
            const def = (schema as unknown as { _zod: { def: { discriminator?: string } } })._zod.def;
            if (def.discriminator !== undefined) {
                return parseDiscriminatedUnion as (zodRef: unknown, options: GenerateMockOptions) => unknown;
            }
            return parseUnion as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        }
        if (schema instanceof z.ZodIntersection) return parseZodIntersection as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodOptional) return parseOptional as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodNullable) return parseOptional as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodFunction) return parseZodFunction as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodPromise) return parseZodPromise as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodTuple) return parseZodTuple as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodString) return parseString as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodNumber) return parseNumber as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodBigInt) return parseNumber as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodBoolean) return parseBoolean as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodDate) return parseDate as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodEnum) {
            // Check if this is actually a nativeEnum (entries have numeric values)
            const entries = (schema as unknown as { _zod: { def: { entries: Record<string, unknown> } } })._zod.def.entries;
            const hasNumericValues = Object.values(entries).some(v => typeof v === 'number');
            const hasReverseMapping = Object.entries(entries).some(([_key, value]) =>
                typeof value === 'number' && String(value) in entries
            );
            if (hasNumericValues && hasReverseMapping) {
                return parseNativeEnum as (zodRef: unknown, options: GenerateMockOptions) => unknown;
            }
            return parseEnum as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        }
        if (schema instanceof z.ZodLiteral) return parseLiteral as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodDefault) return parseZodDefault as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodNaN) return (() => undefined) as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodNull) return (() => null) as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodVoid) return (() => undefined) as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodUndefined) return (() => undefined) as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodCustom) return parseCustom as (zodRef: unknown, options: GenerateMockOptions) => unknown;
        if (schema instanceof z.ZodAny) return parseCustom as (zodRef: unknown, options: GenerateMockOptions) => unknown;

        return undefined;
    }

    export interface GenerateMockOptions {
        keyName?: string;
        /**
         * Note: callback functions are not called with any
         * parameters at this time.
         */
        stringMap?: Record<string, (...args: unknown[]) => string>;

        /**
         * This is a function that can be provided to match a key name with a specific mock
         * Otherwise it searches the faker library for a matching function name
         */
        mockeryMapper?: MockeryMapper;

        /**
         * This is a mapping of field name to mock generator function.
         * This mapping can be used to provide backup mock
         * functions for Zod types not yet implemented.
         * The functions in this map will only be used if this library
         * is unable to find an appropriate mocking function to use.
         */
        backupMocks?: {
            [key: string]: (schema: ZodTypeAny, options: GenerateMockOptions) => unknown;
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
        // deno-lint-ignore no-explicit-any
    ): any {
        const defaultOptions: GenerateMockOptions = {
            maxDepth: 10,
            currentDepth: 0,
            faker: new Faker({ locale: [en] }) as Faker, // Use a new Faker instance by default
            ...options
        };

        if (defaultOptions.seed !== undefined) {
            (defaultOptions.faker as Faker).seed(defaultOptions.seed);
        }

        try {
            const defType = getDefType(schema);

            if (defType === 'undefined' && defaultOptions.backupMocks?.ZodUndefined) {
                return defaultOptions.backupMocks.ZodUndefined(schema, defaultOptions);
            }

            const mockFunction = getMockHandler(schema);
            if (mockFunction) {
                // Pass the backupMocks and maxDepth to nested calls
                return mockFunction(schema, {
                    ...defaultOptions,
                    backupMocks: defaultOptions.backupMocks,
                    maxDepth: defaultOptions.maxDepth,
                });
            } else if (defaultOptions.backupMocks?.[defType]) {
                return defaultOptions.backupMocks[defType](schema, defaultOptions);
            } else if (defaultOptions.throwOnUnknownType) {
                throw new ZodMockError(defType);
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
