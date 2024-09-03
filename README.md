# [Deno] Zod Factory 

<small>
<small>

A factory is a function that generates mock data based on a given schema. It is useful for generating test data for your application.


### Peer Dependencies 
> _Required dependencies for factory to work_



- `https://deno.land/x/zod@v3.23.8/mod.ts`

- `https://esm.sh/@faker-js/faker@8.4.1`



## Usage
<small>
To set up a factory for a deeply nested schema using the `faker` callback, you follow a similar approach to the basic schema example, but you need to account for the nested structure when defining your `faker` callback. 
</small>

### Step 1: Define a Simple Zod Schema

> _First, we'll define a simple schema using Zod for a user profile:_

<small>

```typescript
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';  // Define a simple Zod schema for a user profile

export const UserSchema = z.object({   
    id: z.string().uuid(),           // Unique identifier for the user  
    name: z.string(),                // User's name  
    email: z.string().email(),       // User's email  
    age: z.number().int().positive() // User's age 
});
```


### Step 2. Define a Simple Zod Factory

> _Now we'll define a simple factory using the `factory` function and the `UserSchema` we just created:_

```typescript 
import { factory } from 'https://github.com/zhorton34/zod-factory/mod.ts';
import { UserSchema } from './user.schema.ts'

export const UserFactory = factory(UserSchema, (faker) => ({
    id: faker.string.uuid(),           
    name: faker.person.fullName(),     
    email: faker.internet.email(),     
    age: faker.number.int({ min: 18, max: 99 })
}));
```

### Step 3: Use the Factory to Generate Mock Data

> _Then we'll use the factory to generate mock data:_

```typescript
import { UserFactory } from "./user.factory.ts"

console.log(UserFactory.create());
```
**Outputs (random values will be generated each time)**
```
{
  id: 'd81b154e-4fa4-11ec-81d3-0242ac130003',
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  age: 34
}
```

### Step 4: Create Multiple Users

> _We can also create multiple users_

```typescript
const users = UserFactory.createMany(2);

console.log(users);
```
**Outputs (random values will be generated each time)**
```
[
  {
    id: 'd81b154e-4fa4-11ec-81d3-0242ac130003',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    age: 34
  },
  {
    id: 'd81b154e-4fa4-11ec-81d3-0242ac130003',
    name: 'John Don',
    email: 'John.don@example.com',
    age: 31
  }
]
```

### Step 5: Create a User with Specific Attributes

> _If you need to override a single or multiple properties to be deterministic, you can pass in an object to the `create` method:_

```typescript
const customUser = UserFactory.create({
  name: 'John Doe',
  email: 'john.doe@example.com',
  age: 25
});

console.log(customUser);
```

**Outputs (random values will be generated each time)**
```
{
  id: 'd81b154e-4fa4-11ec-81d3-0242ac130003',
  name: 'John Doe',
  email: 'john.doe@example.com',
  age: 25
}
```

### Step 6: Create many users with specific attributes

> _We can also create many users with specific attributes_

```typescript
const customUsers = UserFactory.createMany(3, { age: 25 })

console.log(customUsers)
```

**outputs (random values will be generated each time accept for age which is set to 25)**
```
[
  {
    id: 'abc1b154e-4fa4-11ec-81d3-0242ac130024',
    name: 'Timmy Bob',
    email: 'timmy.bob@example.com',
    age: 25
  },
  {
    id: 'd81b154e-4fa4-11ec-81d3-0242ac130003',
    name: 'John Doe',
    email: 'john.doe@example.com',
    age: 25
  },
{
    id: 'aa2b154e-4fa4-11ec-81d3-0242ac130003',
    name: 'Sarah Black',
    email: 'sarah.black@example.com',
    age: 25
  },
]
```

### Explanation

-   **`UserSchema`**: Defines the shape of our user data, specifying the types and constraints.
-   **`UserFactory`**: Uses the `faker` library to dynamically generate mock data conforming to `UserSchema`.
-   **`create` and `createMany`**: Methods to generate one or many instances of user data.
-   **`attributes`**: An optional parameter to override generated values for a single or multiple properties to be deterministic.



### Example: Setting Up a Factory for a Deeply Nested Schema

> Let's create a `ComplexUserFactory` for generating mock data based on a deeply nested schema. This will demonstrate how to handle nested objects and arrays while still utilizing the `faker` callback for dynamic data generation.

#### Step 1: Define the Deeply Nested Zod Schema

> _We'll define a more complex schema with nested objects and arrays:_

```typescript
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

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

```typescript
import { factory } from './mod.ts'; // Import the factory implementation
import { ComplexUserSchema } from './schema.ts';
 
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

- Create a single complex user mock object
- Create multiple complex user mock objects
- Create a complex user with specific attributes (override a single or multiple properties to be deterministic)
- Create a complex user with a specific number of posts (override a single or multiple properties to be deterministic)

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

</small>

<small>
Test Coverage: 
High test coverage percentage
</small>

---
<small>
<small>
<small>

```bash
Factory - basic creation tests ...
  factory - create ... ok
  factory - create with custom attributes ... ok 
  factory - createMany ... ok
  factory - createMany with custom attributes ... ok 
Factory - basic creation tests ... ok
Factory - raw tests ...
  factory - raw ... ok 
  factory - raw with custom attributes ... ok 
Factory - raw tests ... ok 
Factory - state tests ...
  factory - state ... ok 
  factory - state with faker ...
------- output -------
[@faker-js/faker]: faker.name is deprecated since v8.0 and will be removed in v10.0. Please use faker.person instead.
----- output end -----
  factory - state with faker ... ok
Factory - state tests ... ok
Factory - input validation tests ...
  factory - handle invalid attribute types ... ok 
  factory - handle missing required attributes ... ok
Factory - input validation tests ... ok 
Factory - performance tests ...
  factory - performance test for createMany ...
------- output -------
Performance test: createMany(100) took 5908ms
----- output end -----
  factory - performance test for createMany ... ok 
Factory - performance tests ... ok 
Factory - complex schema tests ...
  complex factory - create validates against schema ... ok 
  complex factory - create sets default user name ... ok 
  complex factory - create with deep profile override ...
  complex factory - create with deep profile override ... ok 
  complex factory - create with deep settings override ...
  complex factory - create with deep settings override ... ok (53ms)
  complex factory - implement with transform ...
------- output -------
{
  "street": "95824 Romaguera Loop",
  "city": "Fort Benny",
  "state": "AL",
  "zip": "17806",
  "county": "Nottinghamshire",
  "sale_date": "2024-10-03",
  "sale_time": "4:34:58 AM",
  "continued_date_time": "N/A",
  "opening_bid": "$200,000",
  "sale_location": "New Orin",
  "firm_file_number": "084439307"
}
----- output end -----
  complex factory - implement with transform ... ok 
Factory - complex schema tests ... ok
Factory - Randomness and Uniqueness ...
  complex factory - createMany generates unique IDs ... ok 
  complex factory - createMany generates unique emails ... ok 
Factory - Randomness and Uniqueness ... ok 
  should generate a mock object using faker ... ok
  should generate mock data of the appropriate type when the field names overlap Faker properties that are not valid functions ... ok
  Should manually mock string key names to set values ... ok
  should convert values produced by Faker to string when the schema type is string. ... ok
  should support generating date strings via Faker for keys of 'date' and 'dateTime'. ... ok 
  should correctly generate date strings for date validated strings ... ok 
  should create mock strings that respect the specified min and max lengths (inclusive) ... ok 
  should respect the max length when the min is greater than the max ... ok 
  should append extra string content to meet a minimum length ... ok 
  should create mock strings that respect the specified length ... ok
  should create mock dates that respect the specified min and max dates ... ok
  should create Maps ... ok 
  should use a user provided generator when a generator for the schema type cannot be found ... ok 
  should use a user provided generator when a generator takes 2 arguments ... ok 
  should work with objects and arrays ... ok 
  should work with the README example ... ok 
  throws an error when configured to if we have not implemented the type mapping ... ok 
  ZodDefault ... ok 
  ZodNativeEnum ... ok
  ZodFunction ... ok 
  ZodIntersection ... ok
  ZodPromise ... ok 
  ZodTuple ...
    basic tuple ... ok
    tuple with Rest args ... ok
  ZodTuple ... ok 
  ZodUnion ... ok 
  Avoid depreciations in strings ... ok 
  should generate strings from regex ... ok
  should handle complex unions ... ok 
  should handle discriminated unions ... ok 
  should handle branded types ... ok 
  ZodVoid ... ok 
  ZodNull ... ok
  ZodNaN ... ok 
  ZodUndefined ... ok
  ZodLazy ... ok 
  Options seed value will return the same random numbers ... ok 
  Options seed value will return the same union & enum members ... ok
  Options seed value will return the same generated regex values ... ok
  Can use my own version of faker ... ok 
  Will mock sub objections properly ... ok
  should handle various date constraints correctly ... ok 
  should handle invalid date constraints ... ok 
  should handle JSON type ... ok 
zod-mock ... ok 
Potential infinite loop or memory exhaustion tests ...
  should handle deep recursive structures without stack overflow ...
------- post-test output -------
Generated nested structure with depth: 5
----- post-test output end -----
  should handle deep recursive structures without stack overflow ... ok
  should handle cyclical references gracefully ... ok 
Potential infinite loop or memory exhaustion tests ... ok

```


</small>
</small>
</small>
