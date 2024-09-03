# Zod Factory (Deno)

A factory is a function that generates mock data based on a given schema. It is useful for generating test data for your application.

## Peer Dependencies (Need these for factory to work)
- `https://deno.land/x/zod@v3.23.8/mod.ts`
- `https://esm.sh/@faker-js/faker@8.4.1`


## Usage
To set up a factory for a deeply nested schema using the `faker` callback, you follow a similar approach to the basic schema example, but you need to account for the nested structure when defining your `faker` callback. 

### Example: Setting Up a Factory for a Deeply Nested Schema

Let's create a `ComplexUserFactory` for generating mock data based on a deeply nested schema. This will demonstrate how to handle nested objects and arrays while still utilizing the `faker` callback for dynamic data generation.

#### Step 1: Define the Deeply Nested Zod Schema

We'll define a more complex schema with nested objects and arrays:

```typescript
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { faker, Faker } from 'https://esm.sh/@faker-js/faker@8.4.1';

// Define a deeply nested Zod schema for a complex user profile
const ComplexUserSchema = z.object({
  id: z.string().uuid(),                             // Unique identifier for the user
  profile: z.object({                                // Nested profile object
    name: z.string(),                                 // User's name
    email: z.string().email(),                        // User's email
    bio: z.string().optional(),                       // Optional bio for the user
    socialMedia: z.array(z.object({                   // Array of nested social media accounts
      platform: z.enum(['twitter', 'facebook', 'instagram']), // Enum for social media platform
      username: z.string(),                            // Username for the social media account
    })),
  }),
  posts: z.array(z.object({                           // Array of nested posts
    title: z.string(),                                 // Title of the post
    content: z.string(),                               // Content of the post
    tags: z.array(z.string()),                         // Array of tags for the post
    publishedAt: z.date(),                             // Date when the post was published
  })),
  settings: z.object({                                // Nested settings object
    theme: z.enum(['light', 'dark']),                  // User interface theme preference
    notifications: z.boolean(),                        // Boolean for whether notifications are enabled
    preferences: z.record(z.string(), z.union([        // Preferences as a record (key-value pairs)
      z.string(), 
      z.number(), 
      z.boolean(),
    ])),
  }),
});
```

#### Step 2: Set Up the Factory Using the `faker` Callback

1. Create schema
```typescript
import { z } from 'https://deno.land/x/zod@v3.20.2/mod.ts';

// Define a deeply nested Zod schema for a complex user profile
export const ComplexUserSchema = z.object({
  id: z.string().uuid(),                             // Unique identifier for the user
  profile: z.object({                                // Nested profile object
    name: z.string(),                                 // User's name
    email: z.string().email(),                        // User's email
    bio: z.string().optional(),                       // Optional bio for the user
    socialMedia: z.array(z.object({                   // Array of nested social media accounts
      platform: z.enum(['twitter', 'facebook', 'instagram']), // Enum for social media platform
      username: z.string(),                            // Username for the social media account
    })),
  }),
  posts: z.array(z.object({                           // Array of nested posts
    title: z.string(),                                 // Title of the post
    content: z.string(),                               // Content of the post
    tags: z.array(z.string()),                         // Array of tags for the post
    publishedAt: z.date(),                             // Date when the post was published
  })),
  settings: z.object({                                // Nested settings object
    theme: z.enum(['light', 'dark']),                  // User interface theme preference
    notifications: z.boolean(),                        // Boolean for whether notifications are enabled
    preferences: z.record(z.string(), z.union([        // Preferences as a record (key-value pairs)
      z.string(), 
      z.number(), 
      z.boolean(),
    ])),
  }),
});
```

2. Set up factory to generate mock data for zod schema (`ComplexUserSchema`) with `factory` function allowing us to provide the schema and a callback with access to `faker` data generation.

```typescript
import { factory } from './mod.ts'; // Import the factory implementation
import { ComplexUserSchema } from './schema.ts';
 
/**
 * Creating Custom Faker
 *
 * This configuration allows you to create a custom Faker instance
 * for generating localized or customized fake data.
 *
 * @note You can create your own Faker instance to override default settings,
 *       such as the locale (e.g., non-US English faked data).
 *
 * @note A default faker is passed into the callback when creating factories,
 *       but you're not obligated to use it.
 *
 * Example of creating a custom Faker instance:
 * ```
 * import { Faker, en } from 'https://cdn.skypack.dev/@faker-js/faker?dts';
 * const customFaker = new Faker({ locales: [en] })
 * ```
 *
 * @var \Faker\Generator
 */

// Create a factory for the ComplexUser schema
const ComplexUserFactory = factory(ComplexUserSchema, (faker) => ({
  id: faker.string.uuid(),                                  // Generate a random UUID for the user ID
  profile: {                                                 // Generate nested profile data
    name: faker.person.fullName(),                           // Generate a random full name
    email: faker.internet.email(),                           // Generate a random email address
    bio: faker.lorem.paragraph(),                            // Generate a random paragraph for the bio
    socialMedia: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({ // Generate 1-3 social media accounts
      platform: faker.helpers.arrayElement(['twitter', 'facebook', 'instagram']),  // Randomly select a platform
      username: faker.internet.userName(),                   // Generate a random username
    })),
  },
  posts: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({ // Generate 1-5 posts
    title: faker.lorem.sentence(),                            // Generate a random title
    content: faker.lorem.paragraphs(),                        // Generate random content
    tags: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.lorem.word()), // Generate 1-5 tags
    publishedAt: faker.date.recent(),                         // Generate a recent date for publishedAt
  })),
  settings: {                                                // Generate settings data
    theme: faker.helpers.arrayElement(['light', 'dark']),     // Randomly select a theme
    notifications: faker.datatype.boolean(),                  // Randomly decide if notifications are enabled
    preferences: Object.fromEntries(                          // Generate random preferences
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
```

#### Step 3: Using the `ComplexUserFactory`

You can now use the `ComplexUserFactory` to generate deeply nested mock data.

```typescript
// Create a single complex user mock object
const complexUser = ComplexUserFactory.create();
console.log(complexUser);
/* Example output:
{
  id: 'd81b154e-4fa4-11ec-81d3-0242ac130003',
  profile: {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    bio: 'Lorem ipsum dolor sit amet...',
    socialMedia: [
      { platform: 'twitter', username: 'janedoe123' }
    ]
  },
  posts: [
    {
      title: 'My First Post',
      content: 'Lorem ipsum dolor sit amet...',
      tags: ['tech', 'deno'],
      publishedAt: '2024-09-02T12:34:56.789Z'
    }
  ],
  settings: {
    theme: 'dark',
    notifications: true,
    preferences: {
      newsletter: true,
      timezone: 'PST'
    }
  }
}
*/

// Create multiple complex user mock objects
const complexUsers = ComplexUserFactory.createMany(3);
console.log(complexUsers); // Outputs an array of 3 complex user objects

// Create a complex user with specific attributes
const customComplexUser = ComplexUserFactory.create({
  profile: { name: 'John Smith', email: 'john.smith@example.com' },
});
console.log(customComplexUser);
/* Example output:
{
  id: 'a52b154e-4fa4-11ec-81d3-0242ac130003',
  profile: {
    name: 'John Smith',
    email: 'john.smith@example.com',
    bio: 'Lorem ipsum dolor sit amet...',
    socialMedia: [
      { platform: 'facebook', username: 'johnsmith' }
    ]
  },
  posts: [
    {
      title: 'Tech Insights',
      content: 'Lorem ipsum dolor sit amet...',
      tags: ['coding', 'deno'],
      publishedAt: '2024-09-02T12:34:56.789Z'
    }
  ],
  settings: {
    theme: 'light',
    notifications: false,
    preferences: {
      updates: false,
      language: 'en'
    }
  }
}
*/
```

### Explanation of the `faker` Callback for Deeply Nested Schema

In this setup:

- **`profile`**: A nested object that includes `name`, `email`, and `bio`, along with an array of social media accounts. Each account object is dynamically generated using `faker` utilities.
- **`posts`**: An array of objects, where each object represents a post with dynamically generated `title`, `content`, `tags`, and `publishedAt`.
- **`settings`**: A nested object for user settings, including random preferences generated using the `faker` utility.

### Conclusion

By using a `faker` callback with a deeply nested schema, you can effectively create complex mock data structures that conform to your application's requirements. This approach ensures that you have realistic, varied test data for all your testing and development needs.